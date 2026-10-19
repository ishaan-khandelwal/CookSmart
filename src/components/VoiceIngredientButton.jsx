import { Ionicons } from '@expo/vector-icons';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { getWebRecordingMimeType, transcribeIngredientSpeech } from '../services/gnaniApi';

// Gnani recommends clips of about 30 seconds for the REST STT endpoint.
const MAX_RECORDING_MS = 30000;
const WEB_MIME_TYPE = getWebRecordingMimeType();
const RECORDING_OPTIONS = {
    ...RecordingPresets.HIGH_QUALITY,
    web: {
        ...RecordingPresets.HIGH_QUALITY.web,
        ...(WEB_MIME_TYPE ? { mimeType: WEB_MIME_TYPE } : {}),
    },
};

function formatDuration(durationMillis) {
    const totalSeconds = Math.floor((durationMillis || 0) / 1000);
    return `0:${String(totalSeconds).padStart(2, '0')}`;
}

function getVoiceErrorMessage(error) {
    if (error?.code === 'MISSING_API_KEY') {
        return 'Voice input is not set up yet. Add GNANI_API_KEY to server/.env.';
    }

    if (error?.code === 'AUTH_ERROR') {
        return 'Gnani rejected the API key. Check GNANI_API_KEY in server/.env.';
    }

    if (error?.status === 429) {
        return 'Gnani is busy right now. Wait a moment and try again.';
    }

    return error?.message || 'Could not transcribe that. Please try again.';
}

export default function VoiceIngredientButton({ onIngredients }) {
    const recorder = useAudioRecorder(RECORDING_OPTIONS);
    const recorderState = useAudioRecorderState(recorder);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [note, setNote] = useState(null);
    const isStoppingRef = useRef(false);
    const isRecording = recorderState.isRecording;

    const stopAndTranscribe = useCallback(async () => {
        if (isStoppingRef.current) {
            return;
        }

        isStoppingRef.current = true;
        setIsTranscribing(true);

        try {
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false }).catch(() => { });

            if (!recorder.uri) {
                throw new Error('No audio was captured. Please try again.');
            }

            const result = await transcribeIngredientSpeech(recorder.uri);
            const ingredients = Array.isArray(result?.ingredients) ? result.ingredients : [];

            if (!ingredients.length) {
                setNote({
                    tone: 'error',
                    text: result?.transcript
                        ? `Heard "${result.transcript}" but no ingredients. Try "tomato, onion, paneer".`
                        : 'Nothing was heard. Try again a little closer to the mic.',
                });
                return;
            }

            onIngredients(ingredients, result.transcript);
            setNote({ tone: 'info', text: `Heard: "${result.transcript}"` });
        } catch (error) {
            setNote({ tone: 'error', text: getVoiceErrorMessage(error) });
        } finally {
            isStoppingRef.current = false;
            setIsTranscribing(false);
        }
    }, [onIngredients, recorder]);

    const startRecording = useCallback(async () => {
        setNote(null);

        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
                setNote({ tone: 'error', text: 'Allow microphone access to add ingredients by voice.' });
                return;
            }

            await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
            await recorder.prepareToRecordAsync();
            recorder.record();
        } catch {
            setNote({ tone: 'error', text: 'Could not start the microphone. Please try again.' });
        }
    }, [recorder]);

    useEffect(() => {
        if (isRecording && recorderState.durationMillis >= MAX_RECORDING_MS) {
            stopAndTranscribe();
        }
    }, [isRecording, recorderState.durationMillis, stopAndTranscribe]);

    // This browser cannot record any format Gnani accepts.
    if (Platform.OS === 'web' && !WEB_MIME_TYPE) {
        return null;
    }

    const handlePress = isRecording ? stopAndTranscribe : startRecording;
    const accent = isRecording ? '#FF6B6B' : '#00C896';
    let label = 'Say your ingredients';
    if (isRecording) label = `Listening ${formatDuration(recorderState.durationMillis)} · tap to stop`;
    if (isTranscribing) label = 'Transcribing with Gnani AI...';

    return (
        <View className="mt-3">
            <Pressable
                className="min-h-[52px] flex-row items-center justify-center rounded-2xl border px-4"
                style={{ borderColor: accent, backgroundColor: `${accent}14` }}
                onPress={handlePress}
                disabled={isTranscribing}
            >
                {isTranscribing ? (
                    <ActivityIndicator size="small" color={accent} />
                ) : (
                    <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={20} color={accent} />
                )}
                <Text className="ml-2.5 text-[15px] font-bold" style={{ color: accent }}>{label}</Text>
            </Pressable>
            {note ? (
                <Text
                    className="mt-2 text-[13px] leading-5"
                    style={{ color: note.tone === 'error' ? '#FF6B6B' : '#8892A4' }}
                >
                    {note.text}
                </Text>
            ) : (
                <Text className="mt-2 text-[13px] leading-5 text-textSecondary">
                    Powered by Gnani speech-to-text. English and Hinglish both work.
                </Text>
            )}
        </View>
    );
}
