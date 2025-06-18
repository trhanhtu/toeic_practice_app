import React, { useCallback, useState } from 'react';
import { Resource, ResourceType } from '@/types/global.type';
import { TouchableOpacity, Image, Text, View, Modal, Dimensions, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioManager } from "@/context/AudioContext";
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RenderResourceProps {
  resource: Resource;
  resourceIndex: number;
  questionId?: string;
  primaryColor?: string;
}

const RenderResource = ({ resource, resourceIndex, questionId, primaryColor = "#004B8D" }: RenderResourceProps) => {
  const { playAudio, currentAudioInfo, isPlaying, stopCurrentAudio } = useAudioManager();
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Animated values for zoom and pan
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Check if this resource is currently playing
  const isThisResourcePlaying =
    currentAudioInfo?.questionId === questionId &&
    currentAudioInfo?.resourceIndex === resourceIndex;

  // Reset zoom and pan values
  const resetImageTransform = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  // Open image modal
  const openImageModal = useCallback(() => {
    setImageModalVisible(true);
    resetImageTransform();
  }, [resetImageTransform]);

  // Close image modal
  const closeImageModal = useCallback(() => {
    setImageModalVisible(false);
    resetImageTransform();
  }, [resetImageTransform]);

  // Pinch gesture handler for zoom
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedScale.value = scale.value;
    },
    onActive: (event) => {
      scale.value = savedScale.value * event.scale;
      // Limit zoom between 1x and 5x
      if (scale.value < 1) scale.value = 1;
      if (scale.value > 5) scale.value = 5;
    },
    onEnd: () => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    },
  });

  // Pan gesture handler for moving zoomed image
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
    onActive: (event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
      
      // Limit pan based on zoom level
      const maxTranslateX = (screenWidth * (scale.value - 1)) / 2;
      const maxTranslateY = (screenHeight * (scale.value - 1)) / 2;
      
      if (translateX.value > maxTranslateX) translateX.value = maxTranslateX;
      if (translateX.value < -maxTranslateX) translateX.value = -maxTranslateX;
      if (translateY.value > maxTranslateY) translateY.value = maxTranslateY;
      if (translateY.value < -maxTranslateY) translateY.value = -maxTranslateY;
    },
    onEnd: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
  });

  // Animated style for the image
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  // Use useCallback to prevent unnecessary re-renders
  const handlePlayAudio = useCallback(() => {
    // If this is the currently playing resource, toggle play/pause
    if (isThisResourcePlaying) {
      if (isPlaying) {
        stopCurrentAudio();
      } else {
        const title = `Audio ${resourceIndex + 1}`;
        playAudio(resource.content, title, resourceIndex, questionId);
      }
    } else {
      // Otherwise, play this audio
      const title = `Audio ${resourceIndex + 1}`;
      playAudio(resource.content, title, resourceIndex, questionId);
    }
  }, [resource.content, resourceIndex, questionId, isThisResourcePlaying, isPlaying]);

  switch (resource.type) {
    case ResourceType.IMAGE:
      return (
        <>
          <TouchableOpacity
            onPress={openImageModal}
            style={{
              marginBottom: 12,
              borderRadius: 8,
              overflow: 'hidden',
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <Image
              source={{ uri: resource.content }}
              style={{
                width: '100%',
                height: 200,
                resizeMode: 'contain',
                backgroundColor: '#f5f5f5',
              }}
            />
            {/* Overlay icon để cho biết có thể zoom */}
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="expand" size={16} color="white" />
            </View>
          </TouchableOpacity>

          {/* Image Zoom Modal */}
          <Modal
            visible={imageModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={closeImageModal}
          >
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <StatusBar backgroundColor="rgba(0, 0, 0, 0.9)" barStyle="light-content" />
              
              {/* Close button */}
              <TouchableOpacity
                onPress={closeImageModal}
                style={{
                  position: 'absolute',
                  top: 50,
                  right: 20,
                  zIndex: 1000,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>

              {/* Zoomable Image */}
              <PanGestureHandler onGestureEvent={panGestureHandler}>
                <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
                    <Animated.View>
                      <Animated.Image
                        source={{ uri: resource.content }}
                        style={[
                          {
                            width: screenWidth,
                            height: screenHeight * 0.8,
                            resizeMode: 'contain',
                          },
                          animatedImageStyle,
                        ]}
                      />
                    </Animated.View>
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>

              {/* Zoom instructions */}
              <View style={{
                position: 'absolute',
                bottom: 50,
                left: 20,
                right: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 8,
                padding: 12,
              }}>
                <Text style={{
                  color: 'white',
                  textAlign: 'center',
                  fontSize: 14,
                  opacity: 0.8,
                }}>
                  Pinch to zoom • Drag to move • Tap X to close
                </Text>
              </View>
            </View>
          </Modal>
        </>
      );

    case ResourceType.AUDIO:
      return (
        <View style={{
          backgroundColor: '#f5f5f5',
          borderRadius: 12,
          padding: 12,
          width: '100%',
        }}>
          <TouchableOpacity
            onPress={handlePlayAudio}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                backgroundColor: primaryColor,
                width: 40,
                height: 40,
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              }}>
                <Ionicons
                  name={isThisResourcePlaying && isPlaying ? "pause" : "play"}
                  size={22}
                  color="white"
                />
              </View>
              <Text style={{ fontSize: 15, color: '#333' }}>
                {`Audio ${resourceIndex + 1}`}
              </Text>
            </View>

            {isThisResourcePlaying && (
              <View style={{
                backgroundColor: 'rgba(0, 75, 141, 0.1)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
                <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500' }}>
                  {isPlaying ? "Now Playing" : "Paused"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );

    case ResourceType.PARAGRAPH:
      return (
        <Text style={{
          marginBottom: 12,
          fontSize: 15,
          lineHeight: 22,
          fontStyle: 'italic',
          color: '#444',
          backgroundColor: '#f9f9f9',
          padding: 12,
          borderRadius: 8,
          borderLeftWidth: 3,
          borderLeftColor: primaryColor,
        }}>
          {resource.content}
        </Text>
      );

    default:
      return null;
  }
};

export default React.memo(RenderResource); // Memoize to prevent unnecessary re-renders