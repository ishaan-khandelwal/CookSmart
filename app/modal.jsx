import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import EditScreenInfo from '../components/EditScreenInfo';
import { Text, View } from '../components/Themed';

export default function ModalScreen() {
    return (
        <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold">Modal</Text>
            <View className="my-[30px] h-px w-4/5" lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
            <EditScreenInfo path="app/modal.jsx" />
            <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
        </View>
    );
}
