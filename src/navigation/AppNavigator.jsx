import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/SignUpScreen';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">
                <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: true }} />
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
