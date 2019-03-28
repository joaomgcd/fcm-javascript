class FCM {
	constructor(){
		this.messageHandler = new MessageHandler();
		this.broadcastChannel = new BroadcastChannelFCM();
		//this.scriptLoader = new ScriptLoader();
		this.isInServiceWorker = navigator.serviceWorker ? false : true;
		if(!FCM.firebaseApp){
			FCM.firebaseApp = {};
		}
	}
	async requestPermissions(){
		if(this.isInServiceWorker) return true;
		
		const result = await Notification.requestPermission()
		if (result === 'denied' || result === 'default') return false

		return true;
	}
	async register(senderId){
		const hasPermissions = await this.requestPermissions();
		if(!hasPermissions) return null;

		const isInServiceWorker = this.isInServiceWorker;
		var existingApp = FCM.firebaseApp[senderId];
		const alreadyInited =  existingApp ? true : false;
		if(!alreadyInited){
			existingApp = firebase.initializeApp({
			  "messagingSenderId": senderId
			},senderId)
			FCM.firebaseApp[senderId] = existingApp;				
		}
		const messaging = existingApp.messaging();
		const handleMessage = async payload => {
			if(!this.messageHandler) return;

			this.messageHandler.handle(payload);			
		};
		if(!isInServiceWorker){
			await messaging.onMessage(handleMessage);
		}
		if(isInServiceWorker){
			await messaging.setBackgroundMessageHandler(handleMessage);
		}		
		if(!alreadyInited && !isInServiceWorker){
			const existingWorkerCount = (await navigator.serviceWorker.getRegistrations()).length;
			if(existingWorkerCount == 0){
				console.log("Registering FCM worker");
				const registration = await navigator.serviceWorker.register(`fcm-javascript/firebase-messaging-sw.js`);
				messaging.useServiceWorker(registration);	
			}
			this.broadcastChannel.onMessageReported(handleMessage);
		}
		if(isInServiceWorker){
			return await messaging.getToken();
		}else{
			return await new Promise((resolve,reject) => {
				this.broadcastChannel.onTokenReported(payload=>{
					if(payload.senderId != senderId) return;

					resolve(payload.token);
				})
				this.broadcastChannel.requestToken(senderId);
			});
		}
	}
	get onMessage(){
		 return this.messageHandler;
	}
}

class MessageHandler{
	constructor(){
		this.listeners = [];
	}
	addListener(listener){
		this.listeners.push(listener);
	}
	handle(payload){
		this.listeners.forEach(listener=>listener(payload));
	}
}

class BroadcastChannelFCM extends BroadcastChannel{
	constructor(){
		super("BroadcastChannelFCM");
		BroadcastChannelFCM.ACTION_REQUEST_TOKEN = 'request-token';
		BroadcastChannelFCM.ACTION_REPORT_TOKEN = 'report-token';

		BroadcastChannelFCM.ACTION_REPORT_MESSAGE = 'report-message';

		BroadcastChannelFCM.EXTRA_SENDER_ID = 'sender-id';
		BroadcastChannelFCM.EXTRA_TOKEN = 'token';
		BroadcastChannelFCM.EXTRA_MESSAGE = 'message';

		this.addEventListener('message',async event => {
			const data = event.data;
			if(!data) return;

			if(data[BroadcastChannelFCM.ACTION_REQUEST_TOKEN]){
				this.doCallback(this.tokenRequestedCallback, data[BroadcastChannelFCM.EXTRA_SENDER_ID]);
			}else if(data[BroadcastChannelFCM.ACTION_REPORT_TOKEN]){
				this.doCallback(this.tokenReportedCallback, {"senderId":data[BroadcastChannelFCM.EXTRA_SENDER_ID],"token":data[BroadcastChannelFCM.EXTRA_TOKEN]});
			}else if(data[BroadcastChannelFCM.ACTION_REPORT_MESSAGE]){
				this.doCallback(this.messageReportedCallback, data[BroadcastChannelFCM.EXTRA_MESSAGE]);
			}
		});
	}

	doCallback(callback,payload){
		if(!callback) return;

		callback(payload);
	}
	postFcmMessage(messageChanger){
		const message = {};
		messageChanger(message);
		this.postMessage(message);
	}


	requestToken(senderId){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REQUEST_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = senderId;
		});
	}
	onTokenRequested(callback){
		this.tokenRequestedCallback = callback;
	}


	reportToken(senderId,token){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = senderId;
			message[BroadcastChannelFCM.EXTRA_TOKEN] = token;
		});
	}
	onTokenReported(callback){
		this.tokenReportedCallback = callback;
	}


	reportMessage(fcmMessage){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_MESSAGE] = true;
			message[BroadcastChannelFCM.EXTRA_MESSAGE] = fcmMessage;
		});
	}
	onMessageReported(callback){
		this.messageReportedCallback = callback;
	}
}