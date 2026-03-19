import { Text, TouchableOpacity } from 'react-native';

export default function Button({ title, onPress, style, textStyle }) {
    return (
        <TouchableOpacity className="items-center rounded-lg bg-black p-[15px]" style={style} onPress={onPress}>
            <Text className="text-base font-bold text-white" style={textStyle}>{title}</Text>
        </TouchableOpacity>
    );
}
