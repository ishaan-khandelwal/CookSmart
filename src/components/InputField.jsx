import { Text, TextInput, View } from 'react-native';

export default function InputField({ label, placeholder, value, onChangeText, secureTextEntry }) {
    return (
        <View className="mb-[15px]">
            {label ? <Text className="mb-[5px] text-sm text-[#333333]">{label}</Text> : null}
            <TextInput
                className="rounded-[5px] border border-[#cccccc] p-2.5 text-base"
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
            />
        </View>
    );
}
