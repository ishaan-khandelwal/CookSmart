import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    getReactNativePersistence,
    initializeAuth,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyCUUIALVtuDqw23nhV8Osfp1O1blQ5UEbo',
    authDomain: 'cooksmart-75831.firebaseapp.com',
    projectId: 'cooksmart-75831',
    storageBucket: 'cooksmart-75831.firebasestorage.app',
    messagingSenderId: '580504153102',
    appId: '1:580504153102:web:debad6c5803e8dcfbde05f',
    measurementId: 'G-HSFVMQQ5YX',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
    try {
        return initializeAuth(app, {
            persistence: getReactNativePersistence(ReactNativeAsyncStorage),
        });
    } catch {
        return getAuth(app);
    }
}

const auth = createAuth();

export const signInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login Error:', error.message);
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
        console.error('Signup Error:', error.message);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout Error:', error.message);
        throw error;
    }
};

export { auth };
