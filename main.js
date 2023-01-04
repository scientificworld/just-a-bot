const mirai = require('mirai-js')
const cron = require('node-cron')
const fs = require('fs')
const axios = require('axios')
var bot = new mirai.Bot()
var conf = JSON.parse(fs.readFileSync('config.json', 'utf8'))
var bl = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'))
async function splitArg(data, next) {
	data.args = data.text.trim().replace(/\s+/g, ' ').split(' ')
	await next()
}
function argFilter(cmd, len = 1) {
	return async (data, next) => (data.args[0] == cmd && data.args.length >= len) ? await next() : void(0)
}
function blackList(txt) {
	return async (data, next) => {
		if (bl.includes(data.sender.id))
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addText(txt)
			})
		else await next()
	}
}
function addCron(sche, text, group, user) {
	cron.schedule(sche, async () => {
		await bot.sendMessage({
			group: group,
			message: new mirai.Message().addAt(user).addText(`\n[提醒事项] ${text}`)
		})
	})
}
(async () => {
	await bot.open({
		baseUrl: 'http://localhost:8080',
		verifyKey: 'INITKEY',
		qq: conf.qq
	})
	JSON.parse(fs.readFileSync('remind.json', 'utf8')).forEach(data => {
		addCron(data.sche, data.text, data.group, data.user)
	})
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).done(async data => {
		if (data.args[0] == 'help') await bot.sendMessage({
			group: data.sender.group.id,
			message: new mirai.Message().addText(`帮助文档`)
		})
	}))
	bot.on('GroupMessage', async data => {
		// 贴贴功能
		if (
			((data.messageChain.find(msg => msg.type == 'At') || {}).target == conf.qq)
			&&
			(((data.messageChain.find(msg => msg.type == 'Plain') || {}).text || '').indexOf('贴贴') > -1)
		) {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addAt(data.sender.id).addText((Math.random() < 0.7) ? ' 贴贴' : ' 开溜')
			})
		}
	})
	bot.on('GroupMessage', async data => {
		// 主动贴贴atri
		if (data.sender.group.id == GROUP_ID && ! [ATRIBOT_ID, conf.qq].includes(data.sender.id) && Math.random() < 0.005) {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addAt(1945872835).addText(' 贴贴')
			})
		}
	})
	bot.on('NudgeEvent', async data => {
		// 戳一戳
		if (data.fromId != conf.qq) {
			if (data.subject.kind == 'Group') await bot.sendNudge({
				group: data.subject.id,
				target: data.fromId
			})
			else await bot.sendNudge({
				friend: data.subject.id,
				target: data.fromId
			})
		}
	})
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).done(async data => {
		// 提醒事项
		args = data.args	
		if (args[0] != 'remind' || args.length < 8) return
		sche = args.slice(1, 7).join(' ')
		text = args.slice(7, args.length).join(' ')
		fs.readFile('remind.json', 'utf8', (err, content) => {
			fs.writeFile(
				'remind.json',
				JSON.stringify(JSON.parse(content).concat({
					sche: sche,
					text: text,
					group: data.sender.group.id,
					user: data.sender.id
				})),
				() => {}
			)
		})
		addCron(sche, text, data.sender.group.id, data.sender.id)
		await bot.sendMessage({
			group: data.sender.group.id,
			message: new mirai.Message().addAt(data.sender.id).addText(' 任务添加成功。')
		})
	}))
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('recommend')).done(async data => {
		// 推荐本子（？）
		list = JSON.parse(fs.readFileSync('recommend.json', 'utf8'))
		choice = list[Math.floor(Math.random() * list.length)]
		msg = new mirai.Message()
		if (data.sender.id != 2104837674) msg = msg
			.addText('随机作品推荐：\n[')
			.addText({ a: '动画', c: '本子', g: 'Gal', n: '小说', v: '音声' }[choice.type])
			.addText('] ')
			.addText(choice.name)
			.addText('\n标签：')
			.addText(choice.tag.join(', '))
			.addText('\n')
		await bot.sendMessage({
			group: data.sender.group.id,
			message: msg.addText('广告：不想动手找资源？仅需vw5r，即可直接获得。')
		})
	}))
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('mc', 1)).done(async data => {
		// 检测mc服状态
		srv = JSON.parse(fs.readFileSync('server.json', 'utf8'))
		if (srv.hasOwnProperty(data.args[1])) {
			info = srv[data.args[1]]
			ip = info.ip
			port = info.port
			proto = info.proto
			descr = `${data.args[1]} (${ip}:${port})`
		} else if (data.args.length > 3) {
			ip = data.args[1]
			port = data.args[2]
			proto = data.args[3]
			descr = `${ip}:${port}`
		}
		if (!['je', 'be'].includes(proto)) return
		res = (await axios.get(`API_URL`)).data
		if (res.status) {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addText(`${descr} 服务器当前在线人数：${res.online_player}/${res.max_player}`)
			})
		} else {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addText(`暂时无法连接到服务器 ${descr}`)
			})
		}
	}))
})()
