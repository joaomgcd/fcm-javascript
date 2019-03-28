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
		const wakeWorkerToRegisterSenderId = senderId =>{
			this.broadcastChannel.requestToken(senderId);
			if(navigator.serviceWorker.controller){
				navigator.serviceWorker.controller.postMessage(senderId);
				return true;			
			}
			return false;
		};
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
			this.broadcastChannel.onMessageReported(handleMessage);
		}
		if(isInServiceWorker){
			await messaging.setBackgroundMessageHandler(handleMessage);
		}		
		if(!alreadyInited && !isInServiceWorker){
			const existingWorkers = await navigator.serviceWorker.getRegistrations();
			const existingWorkerCount = existingWorkers.length;
			var existingWorker = null;
			if(existingWorkerCount == 0){
				console.log("Registering FCM worker");
				existingWorker = await navigator.serviceWorker.register(`/firebase-messaging-sw.js`);
				messaging.useServiceWorker(existingWorker);	
			}else{
				existingWorker = existingWorkers[0];
			}
			this.broadcastChannel.onWorkerRunning(()=>{
				wakeWorkerToRegisterSenderId(senderId);
			});
		}
		if(isInServiceWorker){
			return await messaging.getToken();
		}else{
			const result = new Promise((resolve,reject) => {
				this.broadcastChannel.onTokenReported(payload=>{
					if(payload.senderId != senderId) return;

					resolve(payload.token);
				})
				const canWakeUp = wakeWorkerToRegisterSenderId(senderId);
			});
			return result;
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

		BroadcastChannelFCM.ACTION_WORKER_RUNNING = 'worker-running';

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
			}else if(data[BroadcastChannelFCM.ACTION_WORKER_RUNNING]){
				this.doCallback(this.workerRunningCallback);
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

	reportWorkerRunning(){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_WORKER_RUNNING] = true;
		});
	}
	onWorkerRunning(callback){
		this.workerRunningCallback = callback;
	}
}