import { StyleSheet, Text, View } from 'react-native';

export default function RecipeDetailScreen() {
    return (
        <View style={styles.container}>
            <Text>Recipe Detail Screen</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
