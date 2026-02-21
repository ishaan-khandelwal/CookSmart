import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Page() {
  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <View style={styles.titleContainer}><Text style={styles.title}>Welcome Back</Text></View>
        <View>
          <Text style={styles.label}>Email:</Text>
          <TextInput placeholder="Enter your email" style={styles.input} />
          <Text style={styles.label}>Password:</Text>
          <TextInput placeholder="Enter your password" style={styles.input} />
        </View>
        <TouchableOpacity>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
        <View style={styles.dividerContainer}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>
        <TouchableOpacity style={styles.SignupButton}>
          <Text style={styles.SignupButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 25
  },
  titleContainer: {
    flex: 1,
    alignItems: "center"
  },
  main: {
    width: '100%',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 60,
  },
  input: {
    borderColor: "#ccc",
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 20,
    borderRadius: 5,
    fontSize: 16,
    color: "#333"
  },
  label: {
    marginBottom: 10,
    fontSize: 20
  },
  forgotPassword: {
    color: "blue",
    marginLeft: 150,
    marginTop: 10
  },
  loginButton: {
    backgroundColor: "black",
    padding: 10,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
    fontSize: 16,
    height: 50,
    marginBottom: 20,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold"
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  orText: {
    marginHorizontal: 10,
    color: "#666",
  },
  SignupButton: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 20,
    alignItems: "center",
    height: 50,
    marginBottom: 20,
    borderColor: "black",
    borderWidth: 1
  },
  SignupButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold"
  },
}); 
