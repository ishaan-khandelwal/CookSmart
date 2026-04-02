import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabBar from '../components/BottomTabBar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { RecipeModeProvider } from '../context/RecipeModeContext';
import CameraScanScreen from '../screens/CameraScanScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import HelpSupportScreen from '../screens/Help&Support';
import HomeScreen from '../screens/HomeScreen';
import IngredientsResultScreen from '../screens/IngredientsResultScreen';
import LoginScreen from '../screens/LoginScreen';
import PlannerScreen from '../screens/PlannerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import RecipeResultsScreen from '../screens/RecipeResultsScreen';
import CreateAccountScreen from '../screens/SignUpScreen';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navigationTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: '#050A10',
        card: '#050A10',
        primary: '#F6B44F',
        text: '#FFFFFF',
        border: 'rgba(255,255,255,0.08)',
    },
};

function MainTabs() {
    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: '#050A10' },
                tabBarHideOnKeyboard: true,
            }}
            tabBar={(props) => <BottomTabBar {...props} />}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="Recipes"
                component={FavoritesScreen}
                options={{ tabBarLabel: 'Recipes' }}
            />
            <Tab.Screen
                name="Scan"
                component={CameraScanScreen}
                options={{ tabBarLabel: 'Scan' }}
            />
            <Tab.Screen
                name="Planner"
                component={PlannerScreen}
                options={{ tabBarLabel: 'Planner' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile' }}
            />
        </Tab.Navigator>
    );
}

function AppScreens() {
    const { user } = useAuth();

    return (
        <Stack.Navigator initialRouteName="Splash">
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
            {user ? (
                <>
                    <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
                    <Stack.Screen
                        name="IngredientsResult"
                        component={IngredientsResultScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="RecipeResults"
                        component={RecipeResultsScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="RecipeDetail"
                        component={RecipeDetailScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="HelpSupport"
                        component={HelpSupportScreen}
                        options={{ headerShown: false }}
                    />
                </>
            ) : (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="CreateAccount" component={CreateAccountScreen} options={{ headerShown: false }} />
                </>
            )}
        </Stack.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <AuthProvider>
            <RecipeModeProvider>
                <NavigationContainer theme={navigationTheme}>
                    <AppScreens />
                </NavigationContainer>
            </RecipeModeProvider>
        </AuthProvider>
    );
}
