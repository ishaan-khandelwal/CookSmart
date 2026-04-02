import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function RecipeModeCard({ mode, selected, onPress }) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.card,
                { backgroundColor: mode.surface, borderColor: selected ? mode.accent : 'rgba(255,255,255,0.08)' },
                selected && styles.cardSelected,
            ]}
        >
            <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${mode.accent}18`, borderColor: `${mode.accent}44` }]}>
                    <Ionicons name={mode.icon} size={20} color={mode.accent} />
                </View>
                {selected ? (
                    <View style={[styles.activePill, { backgroundColor: mode.accent }]}>
                        <Text style={styles.activePillText}>Selected</Text>
                    </View>
                ) : null}
            </View>

            <Text style={styles.title}>{mode.title}</Text>
            <Text style={styles.description}>{mode.description}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        minHeight: 154,
        borderRadius: 28,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    cardSelected: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.24,
        shadowRadius: 18,
        elevation: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activePill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    activePillText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0B1016',
        textTransform: 'uppercase',
        letterSpacing: 0.9,
    },
    title: {
        marginTop: 18,
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    description: {
        marginTop: 10,
        fontSize: 13,
        lineHeight: 20,
        color: 'rgba(255,255,255,0.74)',
    },
});
