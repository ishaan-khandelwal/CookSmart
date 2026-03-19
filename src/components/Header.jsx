import { Text, View } from 'react-native';

export default function Header({ title }) {
    return (
        <View className="h-[60px] justify-center border-b border-[#eeeeee] bg-white px-[15px]">
            <Text className="text-xl font-bold">{title}</Text>
        </View>
    );
}
