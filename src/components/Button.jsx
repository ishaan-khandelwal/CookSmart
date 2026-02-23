import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function Button({ title, onPress, style, textStyle }) {
    return (
        <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
            <Text style={[styles.text, textStyle]}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#000',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
