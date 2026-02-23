import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateAccountScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <View>
                <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30 }}>Create Account</Text>
            </View>
            <View>
                <Text>First Name</Text>
                <TextInput placeholder="Enter your first name" style={styles.input} />
            </View>
            <View>
                <Text>Last Name</Text>
                <TextInput placeholder="Enter your last name" style={styles.input} />
            </View>
            <View>
                <Text>Email</Text>
                <TextInput placeholder="Enter your email" style={styles.input} />
            </View>
            <View>
                <Text>Password</Text>
                <TextInput placeholder="Enter your password" style={styles.input} />
            </View>
            <View>
                <Text>Confirm Password</Text>
                <TextInput placeholder="Confirm your password" style={styles.input} />
            </View>
            <TouchableOpacity style={styles.button}>
                <Text style={{ color: 'white' }}>Register</Text>
            </TouchableOpacity>
            <View>
                <View>
                    <Text>Already have an account?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={{ color: 'blue' }}>Login</Text></TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 20,
        fontSize: 16,
        color: '#333'

    },
    button: {
        backgroundColor: "black",
        padding: 10,
        borderRadius: 20,
        alignItems: "center",
        marginTop: 20,
        height: 50,
        marginBottom: 20,
    }

});
