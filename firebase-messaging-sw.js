self.importScripts('https://www.gstatic.com/firebasejs/5.9.1/firebase-app.js');
self.importScripts('https://www.gstatic.com/firebasejs/5.9.1/firebase-messaging.js');
self.importScripts('/fcm.js');

const broadcastChannel = new BroadcastChannelFCM();

const fcm = new FCM();
const register = async (senderId, count,error) => {
	if(count>=3){
		console.error(`Giving up registration!!`,error);
		return null;
	}
	if(count > 0){
		console.log(`Retrying register ${count}...`)
	}
	try{
		const token = await fcm.register(senderId);		
		return token;
	}catch(error){
		if(!count){
			count = 0;
		}
		return register(senderId,++count,error);
	}
}
const getTokenAndReport = async senderId =>{
    console.log("SW registering and Reporting", senderId);
	const token = await register(senderId);
	broadcastChannel.reportToken(senderId,token);
	return token;
}
broadcastChannel.onTokenRequested(async senderId=>{
	await getTokenAndReport(senderId);
});
fcm.onMessage.addListener(async payload=>{
	broadcastChannel.reportMessage(payload);
});
self.addEventListener('message', async event => {
	const senderId = event.data;
	await getTokenAndReport(senderId);
});
broadcastChannel.reportWorkerRunning();