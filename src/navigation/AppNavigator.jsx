import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/SignUpScreen';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator();

function AppScreens() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <Stack.Navigator initialRouteName={user ? 'Home' : 'Login'}>
            {user ? (
                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: true }} />
            ) : (
                <>
                    <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="CreateAccount" component={CreateAccountScreen} options={{ title: 'Create Account' }} />
                </>
            )}
        </Stack.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <AuthProvider>
            <NavigationContainer>
                <AppScreens />
            </NavigationContainer>
        </AuthProvider>
    );
}
