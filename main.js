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
function argFilter(cmd, len = 0) {
	return async (data, next) => (data.args[0] == cmd && data.args.length > len) ? await next() : void(0)
}
function blackList(txt = '') {
	return async (data, next) => {
		if (bl.includes(data.sender.id)) {
			if (txt != '')
				await bot.sendMessage({
					group: data.sender.group.id,
					message: new mirai.Message().addText(txt)
				})
		}
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
		verifyKey: '',
		qq: conf.qq
	})
	JSON.parse(fs.readFileSync('remind.json', 'utf8')).forEach(data => {
		addCron(data.sche, data.text, data.group, data.user)
	})
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).done(async data => {
		if (data.args[0] == 'help') await bot.sendMessage({
			group: data.sender.group.id,
			message: new mirai.Message().addText(``)
		})
	}))
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).done(async data => {
		// 贴贴功能
		if ((((data.messageChain.find(msg => msg.type == 'Plain') || {}).text || '').indexOf('贴贴') > -1)) {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addAt(data.sender.id).addText((Math.random() < 0.7) ? ' 贴贴' : ' 开溜')
			})
		}
	}))
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
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('remind', 7)).use(blackList()).done(async data => {
		// 提醒事项
		args = data.args	
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
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('recommend')).use(blackList()).done(async data => {
		// 推荐本子（？）
		list = JSON.parse(fs.readFileSync('recommend.json', 'utf8'))
		choice = list[Math.floor(Math.random() * list.length)]
		await bot.sendMessage({
			group: data.sender.group.id,
			message: new mirai.Message()
				.addText('随机作品推荐：\n[')
				.addText({ a: '动画', c: '本子', g: 'Gal', n: '小说', v: '音声' }[choice.type])
				.addText('] ')
				.addText(choice.name)
				.addText('\n标签：')
				.addText(choice.tag.join(', '))
		})
	}))
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('mc', 1)).use(blackList()).done(async data => {
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
		res = (await axios.get(``)).data
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
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('bgmtime', 1)).done(async data => {
		await axios.get(`https://api.bgm.tv/v0/users/${data.args[1]}`, {
			headers: { 'User-Agent': '' }
		}).then(async resp => {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addImageUrl(`https://bgm.tv/chart/img/${resp.data.id}`)
			})
		}).catch(async err => {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addText('找不到用户。')
			})
		})
	}))
	bot.on('GroupMessage', new mirai.Middleware().atFilter([conf.qq]).textProcessor().use(splitArg).use(argFilter('select', 2)).done(async data => {
		args = data.args
		cnt = parseInt(args[1])
		if (isNaN(cnt)) return
		list = args.slice(2)
		if (list.length <= cnt || cnt <= 1) {
			await bot.sendMessage({
				group: data.sender.group.id,
				message: new mirai.Message().addText('数据量或样本量不足。')
			})
			return
		}
		i = list.length, lim = i - cnt
		while (i > lim) {
			index = Math.floor(Math.random() * i--)
			list[index] = [list[i], list[i] = list[index]][0]
		}
		await bot.sendMessage({
			group: data.sender.group.id,
			message: new mirai.Message().addText(list.slice(lim).join('，'))
		})
	}))
})()
