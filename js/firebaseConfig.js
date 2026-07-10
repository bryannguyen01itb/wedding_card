const firebaseConfig = {
    apiKey: "AIzaSyCwFkIVUn-1AMjwA8eK1eVISfUr5NIhmz0",
    authDomain: "wedding-invitation-31e4d.firebaseapp.com",
    projectId: "wedding-invitation-31e4d",
    storageBucket: "wedding-invitation-31e4d.firebasestorage.app",
    messagingSenderId: "911182327074",
    appId: "1:911182327074:web:46c40e330fce706ceb897b"
  };

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
