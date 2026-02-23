import { StyleSheet, Text, View } from 'react-native';

export default function Header({ title }) {
    return (
        <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 60,
        backgroundColor: '#fff',
        justifyContent: 'center',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
});
