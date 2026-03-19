import { Feather, Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCAN_LIFT = 18;

function getIconName(routeName, isFocused) {
    if (routeName === 'Home') return isFocused ? 'home' : 'home-outline';
    if (routeName === 'Recipes') return isFocused ? 'book' : 'book-outline';
    if (routeName === 'Planner') return isFocused ? 'calendar' : 'calendar-outline';
    if (routeName === 'Profile') return isFocused ? 'person' : 'person-outline';
    return 'ellipse-outline';
}

export default function BottomTabBar({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();

    return (
        <View className="bg-transparent px-[10px]" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
            <View
                className="absolute bottom-0 left-0 right-0 flex-row rounded-[28px] border border-white/10 bg-[#161616] px-1 pt-2.5"
                style={{
                    shadowColor: '#000000',
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 18,
                }}
            >
                <View className="absolute left-5 right-5 top-0 h-px bg-[#f59e0b38]" />
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label = options.tabBarLabel ?? options.title ?? route.name;
                    const isFocused = state.index === index;
                    const isScan = route.name === 'Scan';

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            className="h-[70px] min-w-0 flex-1 items-center justify-end"
                            activeOpacity={0.9}
                        >
                            <View className="w-full items-center justify-end px-px" style={isScan ? { transform: [{ translateY: -SCAN_LIFT }] } : undefined}>
                                {isScan ? (
                                    <View
                                        className="mb-1 h-14 w-14 items-center justify-center rounded-full border bg-[#111111]"
                                        style={{
                                            borderColor: isFocused ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.08)',
                                            shadowColor: '#000000',
                                            shadowOpacity: 0.3,
                                            shadowRadius: 16,
                                            shadowOffset: { width: 0, height: 10 },
                                            elevation: 14,
                                        }}
                                    >
                                        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F59E0B]">
                                            <Feather name="camera" size={20} color="#111111" />
                                        </View>
                                    </View>
                                ) : (
                                    <View className={`mb-1 h-[34px] w-[34px] items-center justify-center rounded-[14px] ${isFocused ? 'bg-[#f59e0b1f]' : 'bg-transparent'}`}>
                                        <Ionicons
                                            name={getIconName(route.name, isFocused)}
                                            size={20}
                                            color={isFocused ? '#F59E0B' : '#8B95A7'}
                                        />
                                    </View>
                                )}
                                <Text
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    className={`w-full text-center text-[9px] font-bold leading-[11px] ${isFocused ? 'text-slate-50' : 'text-[#8B95A7]'} ${isScan && isFocused ? 'text-[#F59E0B]' : ''}`}
                                >
                                    {label}
                                </Text>
                                <View className="mt-1 h-2 items-center justify-end">
                                    {isFocused && !isScan ? <View className="h-[3px] w-4 rounded-full bg-[#F59E0B]" /> : null}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
