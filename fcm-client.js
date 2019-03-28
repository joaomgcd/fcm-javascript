//EDIT THIS FILE

/***
* Name the FCMClientTest whatever you want but make sure it extends FCMClient
* Make sure to call the super() constructor with your sender ids
* When your website is closed the handleBackgroundMessage will be called. You should create a notification there.
***/
class FCMClientTest extends FCMClient{
	constructor(){
		super(["YOUR_SENDER_ID"])
	}
	handleBackgroundMessage(serviceWorker, payload){
		serviceWorker.registration.showNotification("Test Notification",{"body":payload.data.message});
	}
}