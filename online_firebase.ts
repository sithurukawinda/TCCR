import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0",
  authDomain: "e-learning-f4209.firebaseapp.com",
  projectId: "e-learning-f4209",
  storageBucket: "e-learning-f4209.firebasestorage.app",
  messagingSenderId: "478818124064",
  appId: "1:478818124064:web:9b8a39cd54024588cb9745",
  measurementId: "G-4XQ84CXZFJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);
