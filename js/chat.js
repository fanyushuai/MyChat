//localStorage.clear();
var user = localStorage.getItem("user");
if(user == null || user == "") {
	user = {
		id: plus.device.uuid,
		nickname: ''
	};
} else {
	user = JSON.parse(user);
	console.log(user.nickname + user.id);
}

function danmu(msg, img) {
	if(img == null || img == '') {
		img = 'haha';
	}
	var item = {
		img: 'images/' + img + '.gif', //图片 
		info: msg.content, //文字 
		href: '#', //链接 
		close: true, //显示关闭按钮 
		speed: 6, //延迟,单位秒,默认6 
		color: '#fff', //颜色,默认白色 
		old_ie_color: '#000000', //ie低版兼容色,不能与网页背景相同,默认黑色 
	}
	jQuery('#body').barrager(item);
}

function dataURL2Audio(base64Str, callback) {
	var base64Str = base64Str.replace('data:audio/amr;base64,', '');
	var audioName = (new Date()).valueOf() + '.amr';

	plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
		fs.root.getFile(audioName, {
			create: true
		}, function(entry) {
			// 获得平台绝对路径
			var fullPath = entry.fullPath;
			if(mui.os.android) {
				// 读取音频
				var Base64 = plus.android.importClass("android.util.Base64");
				var FileOutputStream = plus.android.importClass("java.io.FileOutputStream");
				try {
					var out = new FileOutputStream(fullPath);
					var bytes = Base64.decode(base64Str, Base64.DEFAULT);
					out.write(bytes);
					out.close();
					callback && callback(entry);
				} catch(e) {
					console.log(e.message);
				}
			} else if(mui.os.ios) {
				var NSData = plus.ios.importClass('NSData');
				var nsData = new NSData();
				nsData = nsData.initWithBase64EncodedStringoptions(base64Str, 0);
				if(nsData) {
					nsData.plusCallMethod({
						writeToFile: fullPath,
						atomically: true
					});
					plus.ios.deleteObject(nsData);
				}
				// 回调
				callback && callback(entry);
			}
		})
	})
}

//与服务器进行连接
var socket = io.connect('http://192.168.137.1:3000');

socket.on('connect', function() {
	socket.emit('join', user);
});

socket.on('reciveJoin', function(msg) {
	console.log("123"+msg.user);
	localStorage.setItem("user", JSON.stringify(msg.user))
	var system = {"id":"1","nickname":"system"};
	
	console.log("***"+msg.user);
	msg.user = system;
	sendMsg(msg, null)
});

//接收来自服务端的信息事件reciveMsg
socket.on('reciveMsg', function(msg) {
	danmu(msg, null);
	record.push({
		sender: msg.sender,
		type: 'text',
		content: msg.content
	});
	bindMsgList();

	if(msg.content == '抖动') {
		jQuery("#body").addClass("shake shake-crazy");
	}

	if(msg.content == '烟花') {
		initAnimate();
	}

	if(msg.content == '雪花') {
		RENDERER.init();
	}
});

socket.on('reciveImg', function(msg) {
	record.push({
		sender: msg.sender,
		type: 'image',
		content: msg.content
	});
	bindMsgList();
});

socket.on('reciveSound', function(msg) {
	dataURL2Audio(msg.content, function(data) {
		console.log("语音" + data.toURL());
		record.push({
			sender: msg.sender,
			type: 'sound',
			content: data.toURL()
		});
		bindMsgList();
	});
});

var send = function(msg) {
	record.push(msg);

	if(msg.content.indexOf('@小管家') != -1) {
		toRobot(msg.content);
	} else {
		sendMsg(msg)
		bindMsgList();
	}

	if(msg.type == 'text') {
		danmu(msg);
	}
};

function getBase64Image(img) {
	// 默认按比例压缩
	var w = img.width,
		h = img.height,
		scale = w / h;
	var quality = 0.1; // 默认图片质量为0.7
	//生成canvas
	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext('2d');
	// 创建属性节点
	var anw = document.createAttribute("width");
	anw.nodeValue = w;
	var anh = document.createAttribute("height");
	anh.nodeValue = h;
	canvas.setAttributeNode(anw);
	canvas.setAttributeNode(anh);
	ctx.drawImage(img, 0, 0, w, h);

	var ext = img.src.substring(img.src.lastIndexOf(".") + 1).toLowerCase();
	var dataURL = canvas.toDataURL("image/" + ext, quality);
	return dataURL;
}

function audio2dataURL(path, callback) {
	plus.io.resolveLocalFileSystemURL(path, function(entry) {
		entry.file(function(file) {
			var reader = new plus.io.FileReader();
			reader.onloadend = function(e) {
				callback && callback(e.target.result);
			};
			reader.readAsDataURL(file);
		}, function(e) {
			console.log("语音错误" + e.message);
		})
	})
}

var sendMsg = function(msg) {
	if(msg.type == 'image') {
		var image = new Image();
		image.src = msg.content;
		image.onload = function() {
			var base64 = compressIMG(image);
			//compressIMG(image);
			//getBase64Image(image);
			socket.emit('sendImg', base64, user.nickname);
		}
	}

	if(msg.type == 'sound') {
		audio2dataURL(msg.content, function(data) {
			socket.emit('sendSound', data, user.nickname);
		});
	}

	if(msg.type == 'text') {
		socket.emit('sendMsg', msg.content, user.nickname);

		if(msg.content == '停止抖动') {
			jQuery("#body").removeClass("shake shake-crazy");
		}

		if(msg.content == '取消烟花') {
			stopAnimate();
		}
	}

}