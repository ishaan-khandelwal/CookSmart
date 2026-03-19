import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { Text, View } from './Themed';

export default function EditScreenInfo({ path }) {
    return (
        <View>
            <View className="mx-[50px] items-center">
                <Text
                    className="text-center text-[17px] leading-6"
                    lightColor="rgba(0,0,0,0.8)"
                    darkColor="rgba(255,255,255,0.8)"
                >
                    Open up the code for this screen:
                </Text>

                <View
                    className="my-[7px] rounded-[3px] px-1"
                    darkColor="rgba(255,255,255,0.05)"
                    lightColor="rgba(0,0,0,0.05)"
                >
                    <MonoText>{path}</MonoText>
                </View>

                <Text
                    className="text-center text-[17px] leading-6"
                    lightColor="rgba(0,0,0,0.8)"
                    darkColor="rgba(255,255,255,0.8)"
                >
                    Change any of the text, save the file, and your app will automatically update.
                </Text>
            </View>

            <View className="mx-5 mt-[15px] items-center">
                <ExternalLink
                    className="py-[15px]"
                    href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
                >
                    <Text className="text-center" lightColor="#2f95dc">
                        Tap here if your app doesn't automatically update after making changes
                    </Text>
                </ExternalLink>
            </View>
        </View>
    );
}
