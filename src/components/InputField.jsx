import { StyleSheet, Text, TextInput, View } from 'react-native';

export default function InputField({ label, placeholder, value, onChangeText, secureTextEntry }) {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        marginBottom: 5,
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        borderRadius: 5,
        fontSize: 16,
    },
});
