import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ScrollView
} from 'react-native';
import { Camera, Zap, Leaf, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
    const handleGetStarted = () => {
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Hero Section */}
                <ImageBackground
                    source={require('../../assets/images/pasta_hero.png')}
                    style={styles.hero}
                >
                    <View style={styles.overlay}>
                        <SafeAreaView style={styles.safeArea}>
                            <View style={styles.header}>
                                <Text style={styles.logoText}>🍳 CookSmart</Text>
                            </View>
                            
                            <View style={styles.heroContent}>
                                <Text style={styles.title}>Cook Smarter,{'\n'}
                                    <Text style={styles.titleHighlight}>Not Harder.</Text>
                                </Text>
                                <Text style={styles.subtitle}>
                                    Turn your leftover ingredients into gourmet meals with AI-powered scanning.
                                </Text>
                                
                                <TouchableOpacity 
                                    style={styles.primaryButton}
                                    onPress={handleGetStarted}
                                >
                                    <Text style={styles.buttonText}>Get Started</Text>
                                    <ArrowRight color="#fff" size={20} />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </View>
                </ImageBackground>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    <Text style={styles.sectionTitle}>Why CookSmart?</Text>
                    
                    <View style={styles.featureCard}>
                        <View style={[styles.iconCircle, { backgroundColor: '#d1fae5' }]}>
                            <Camera color="#10b981" size={24} />
                        </View>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>AI Ingredient Scanner</Text>
                            <Text style={styles.featureDescription}>Snap a photo and identify every ingredient instantly.</Text>
                        </View>
                    </View>

                    <View style={styles.featureCard}>
                        <View style={[styles.iconCircle, { backgroundColor: '#fff7ed' }]}>
                            <Zap color="#f59e0b" size={24} />
                        </View>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>Smart Recipes</Text>
                            <Text style={styles.featureDescription}>Get personalized recipe suggestions based on your pantry.</Text>
                        </View>
                    </View>

                    <View style={styles.featureCard}>
                        <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                            <Leaf color="#3b82f6" size={24} />
                        </View>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>Zero Food Waste</Text>
                            <Text style={styles.featureDescription}>Save money and the planet by using what you have.</Text>
                        </View>
                    </View>
                </View>

                {/* Footer Quote */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        "Empowering home cooks to create magic from leftovers."
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    hero: {
        width: width,
        height: 600,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    heroContent: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#fff',
        lineHeight: 56,
    },
    titleHighlight: {
        color: '#10b981',
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 16,
        lineHeight: 28,
    },
    primaryButton: {
        backgroundColor: '#10b981',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        alignSelf: 'flex-start',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
    featuresSection: {
        padding: 24,
        backgroundColor: '#fff',
        marginTop: -30,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 24,
        textAlign: 'center',
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 20,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureTextContainer: {
        marginLeft: 16,
        flex: 1,
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    featureDescription: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    footer: {
        padding: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 16,
        fontStyle: 'italic',
        color: '#64748b',
        textAlign: 'center',
    },
});
