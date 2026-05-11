import { Feather, Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCAN_LIFT = 6;
const DOCK_HEIGHT = 96;
const DOCK_SIDE_PADDING = 16;
const DOCK_BOTTOM_GAP = 10;
const DOCK_EXTRA_CLEARANCE = 12;

export const BOTTOM_TAB_BAR_RESERVED_SPACE = DOCK_HEIGHT + DOCK_BOTTOM_GAP + DOCK_EXTRA_CLEARANCE;

function getIconName(routeName, isFocused) {
    if (routeName === 'Home') return isFocused ? 'home' : 'home-outline';
    if (routeName === 'Recipes') return isFocused ? 'book' : 'book-outline';
    if (routeName === 'Planner') return isFocused ? 'calendar' : 'calendar-outline';
    if (routeName === 'Profile') return isFocused ? 'person' : 'person-outline';
    return 'ellipse-outline';
}

export default function BottomTabBar({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();
    const dockBottom = Math.max(insets.bottom, DOCK_BOTTOM_GAP);
    const reservedHeight = DOCK_HEIGHT + dockBottom + DOCK_EXTRA_CLEARANCE;
    const activeRoute = state.routes[state.index];
    const scanRoute = state.routes.find((route) => route.name === 'Scan');
    const isScanFocused = activeRoute?.name === 'Scan';

    if (activeRoute?.name === 'Scan') {
        return null;
    }

    return (
        <View
            pointerEvents="box-none"
            className="bg-transparent"
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: reservedHeight,
                paddingHorizontal: DOCK_SIDE_PADDING,
            }}
        >
            <View
                className="absolute left-0 right-0 rounded-[32px] border border-white/8"
                style={{
                    bottom: dockBottom,
                    height: DOCK_HEIGHT,
                    left: DOCK_SIDE_PADDING,
                    right: DOCK_SIDE_PADDING,
                    alignSelf: 'center',
                    backgroundColor: 'rgba(7,16,24,0.9)',
                    shadowColor: '#000000',
                    shadowOpacity: 0.28,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 12 },
                    elevation: 20,
                }}
            >
                <View className="flex-1 flex-row px-2 pt-2.5">
                    {state.routes.filter((route) => route.name !== 'Scan').map((route) => {
                        const index = state.routes.findIndex((candidate) => candidate.key === route.key);
                        const { options } = descriptors[route.key];
                        const label = options.tabBarLabel ?? options.title ?? route.name;
                        const isFocused = state.index === index;

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
                                className="min-w-0 flex-1 items-center justify-center bg-transparent"
                                activeOpacity={0.9}
                            >
                                <View className={`w-full items-center rounded-[18px] px-1 py-1.5 ${isFocused ? 'bg-white/6' : 'bg-transparent'}`}>
                                    <View className={`h-9 w-9 items-center justify-center rounded-[14px] ${isFocused ? 'bg-[#f6b44f]/10' : 'bg-transparent'}`}>
                                        <Ionicons
                                            name={getIconName(route.name, isFocused)}
                                            size={19}
                                            color={isFocused ? '#F6B44F' : '#8397AA'}
                                        />
                                    </View>
                                    <Text
                                        numberOfLines={1}
                                        allowFontScaling={false}
                                        className={`mt-1 text-[9px] font-bold ${isFocused ? 'text-white' : 'text-[#8397AA]'}`}
                                    >
                                        {label}
                                    </Text>
                                    <View className="mt-1 h-[3px] justify-end">
                                        {isFocused ? <View className="h-[3px] w-5 rounded-full bg-[#F6B44F]" /> : null}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {scanRoute ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={isScanFocused ? { selected: true } : {}}
                    onPress={() => navigation.navigate(scanRoute.name)}
                    activeOpacity={0.9}
                    style={{
                        position: 'absolute',
                        alignSelf: 'center',
                        bottom: dockBottom + DOCK_HEIGHT - 24,
                        zIndex: 5,
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <View className="items-center justify-center" style={{ transform: [{ translateY: -SCAN_LIFT }] }}>
                        <View
                            className="mb-1 h-[64px] w-[64px] items-center justify-center rounded-full border"
                            style={{
                                borderColor: isScanFocused ? 'rgba(246, 180, 79, 0.45)' : 'rgba(255,255,255,0.1)',
                                backgroundColor: '#071018',
                                shadowColor: '#000000',
                                shadowOpacity: 0.28,
                                shadowRadius: 18,
                                shadowOffset: { width: 0, height: 10 },
                                elevation: 16,
                            }}
                        >
                            <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-[#F6B44F]">
                                <Feather name="camera" size={22} color="#08131c" />
                            </View>
                        </View>
                        <Text
                            numberOfLines={1}
                            allowFontScaling={false}
                            className={`text-[10px] font-bold ${isScanFocused ? 'text-[#F6B44F]' : 'text-[#8AA0B5]'}`}
                        >
                            {descriptors[scanRoute.key]?.options?.tabBarLabel ?? 'Scan'}
                        </Text>
                    </View>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
