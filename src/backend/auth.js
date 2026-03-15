import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    FacebookAuthProvider,
    getReactNativePersistence,
    GoogleAuthProvider,
    initializeAuth,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUUIALVtuDqw23nhV8Osfp1O1blQ5UEbo",
    authDomain: "cooksmart-75831.firebaseapp.com",
    projectId: "cooksmart-75831",
    storageBucket: "cooksmart-75831.firebasestorage.app",
    messagingSenderId: "580504153102",
    appId: "1:580504153102:web:debad6c5803e8dcfbde05f",
    measurementId: "G-HSFVMQQ5YX"
};

// Initialize Firebase with Persistence for React Native
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// ─── Email / Password ────────────────────────────────────────────────────────
export const signInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Login Error:", error.message);
        throw error;
    }
};

export const signUpWithEmail = async (email, password, fullName) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName?.trim()) {
            await updateProfile(userCredential.user, {
                displayName: fullName.trim(),
            });
        }
        return userCredential.user;
    } catch (error) {
        console.error("Signup Error:", error.message);
        throw error;
    }
};

// ─── Google Sign-In (via expo-auth-session id_token flow) ───────────────────
export const signInWithGoogleCredential = async (idToken) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential.user;
};

// ─── Facebook Sign-In (via expo-auth-session access_token flow) ─────────────
export const signInWithFacebookCredential = async (accessToken) => {
    const credential = FacebookAuthProvider.credential(accessToken);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential.user;
};

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error.message);
        throw error;
    }
};

export { auth };

