// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2uDjuCHTNY2bPLCGN-ZWRElYsbnYnj3I",
  authDomain: "tic-tac-toe-dcd33.firebaseapp.com",
  databaseURL: "https://tic-tac-toe-dcd33-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tic-tac-toe-dcd33",
  storageBucket: "tic-tac-toe-dcd33.firebasestorage.app",
  messagingSenderId: "1055925926979",
  appId: "1:1055925926979:web:d9d3b8ccdf7b4f10b3a8f6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
