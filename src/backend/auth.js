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

const getFirebaseErrorMessage = (error) => {
    const errorCode = error?.code || '';
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email. Please sign up first.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check your credentials.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try logging in instead.';
        case 'auth/weak-password':
            return 'Password is too weak. Please use at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign-in is not enabled. Please contact support.';
        default:
            return error?.message || 'An unexpected error occurred. Please try again.';
    }
};

export const signInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login Error:', error.code, error.message);
        const friendlyError = new Error(getFirebaseErrorMessage(error));
        throw friendlyError;
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
        console.error('Signup Error:', error.code, error.message);
        const friendlyError = new Error(getFirebaseErrorMessage(error));
        throw friendlyError;
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
