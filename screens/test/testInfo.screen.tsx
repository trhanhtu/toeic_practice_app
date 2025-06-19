import CommentSystem from '@/components/CommentSession';
import testService from '@/services/test.service';
import { BaseObject, CommentTargetType } from '@/types/global.type';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COMPLETED_TESTS_KEY = 'completed_tests';

// TestInfo interface as provided
export interface TestInfo extends BaseObject {
  name: string;
  totalUserAttempt: number;
  totalQuestion: number;
  totalScore: number;
  limitTime: number;
  resultsOverview: any[];
  topicsOverview: {
    partNum: number;
    topicNames: string[];
  }[];
}

// Interface for test details
interface TestDetail {
  label: string;
  value: string;
}

// Interface for route params
interface TestInfoParams {
  testId: string;
}

export default function TestInfoScreen(): JSX.Element {
  const params = useLocalSearchParams<TestInfoParams>();
  const testId = params.testId;
  const router = useRouter();

  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>(undefined);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Function to check if test has been completed before
  const checkTestCompletion = async (id: string): Promise<void> => {
    try {
      const testsData = await AsyncStorage.getItem(COMPLETED_TESTS_KEY);
      if (testsData) {
        const parsedTestIds = JSON.parse(testsData);
        setIsCompleted(parsedTestIds.includes(id));
      }
    } catch (err) {
      console.error('Error checking test completion:', err);
    }
  };

  // Function to save completed test - moved from TestListScreen
  const saveCompletedTest = async (id: string): Promise<void> => {
    try {
      // Get current completed tests
      const testsData = await AsyncStorage.getItem(COMPLETED_TESTS_KEY);
      let completedTests: string[] = [];

      if (testsData) {
        completedTests = JSON.parse(testsData);
      }

      // Add new test ID if not already in the list
      if (!completedTests.includes(id)) {
        completedTests.push(id);
        await AsyncStorage.setItem(COMPLETED_TESTS_KEY, JSON.stringify(completedTests));

        // Update local state
        setIsCompleted(true);
      }
    } catch (error) {
      console.error('Error saving completed test:', error);
    }
  };

  // Interface for user info
  interface UserInfo {
    id: string;
    avatarUrl?: string;
    [key: string]: any; // For other potential user properties
  }

  // Fetch user info for comments
  const fetchUserInfo = async (): Promise<void> => {
    try {
      const userInfoJson = await AsyncStorage.getItem('userInfo');
      if (userInfoJson) {
        const userInfo: UserInfo = JSON.parse(userInfoJson);
        setCurrentUserId(userInfo.id || '');
        setUserAvatarUrl(userInfo.avatarUrl);
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  // Fetch test info when component mounts or when testId changes
  useFocusEffect(
    useCallback(() => {
      if (testId) {
        fetchTestInfo(testId);
        checkTestCompletion(testId);
        fetchUserInfo();
      }

      return () => {
        // Cleanup if needed
      };
    }, [testId])
  );

  // Function to fetch test info
  const fetchTestInfo = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await testService.getTestInfo(id);

      if (response.success && response.data) {
        setTestInfo(response.data as TestInfo);
      } else {
        setError(response.message || 'Failed to load test information');
      }
    } catch (err) {
      console.error('Error fetching test info:', err);
      setError('An error occurred while loading test information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle starting the test - Now saves completed test here
  const handleStartTest = async (): Promise<void> => {
    if (!testId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Mark this test as completed when the user starts it
    await saveCompletedTest(testId);

    await router.push({
      pathname: '/(main)/test',
      params: { testId },
    });
  };

  // Handle getting draft
  const handleGetDraft = async (): Promise<void> => {
    if (!testId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await router.push({
      pathname: '/(main)/draft',
    });
  };

  // Format test details for display
  const formatTestDetails = (): TestDetail[] => {
    if (!testInfo) return [];

    return [
      { label: 'Duration', value: `${testInfo.limitTime} minutes` },
      { label: 'Questions', value: testInfo.totalQuestion.toString() },
      { label: 'Parts', value: getPartsDisplay(testInfo.topicsOverview) },
    ];
  };

  // Helper function to get parts display text
  const getPartsDisplay = (topicsOverview: TestInfo['topicsOverview']): string => {
    if (!topicsOverview || topicsOverview.length === 0) return 'All parts';

    const partNumbers = topicsOverview.map(topic => `Part ${topic.partNum}`);
    return partNumbers.join(', ');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <LottieView
          source={require('@/assets/animations/loading.json')}
          autoPlay
          loop
          style={{ width: 30, height: 30 }}
        />
        <Text className="mt-4 text-base text-gray-500">Loading test information...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white p-5">
        <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
        <Text className="text-xl font-semibold text-gray-800 mt-4">Error Loading Test</Text>
        <Text className="text-base text-gray-500 text-center mt-2 mx-8">{error}</Text>
        <TouchableOpacity
          className="bg-blue-500 py-2.5 px-5 rounded-lg mt-5"
          onPress={() => testId && fetchTestInfo(testId)}
        >
          <Text className="text-white font-medium text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!testInfo) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white p-5">
        <Ionicons name="information-circle-outline" size={60} color="#f59e0b" />
        <Text className="text-xl font-semibold text-gray-800 mt-4">No Test Found</Text>
        <Text className="text-base text-gray-500 text-center mt-2 mx-8">Test information could not be found.</Text>
        <TouchableOpacity
          className="bg-blue-500 py-2.5 px-5 rounded-lg mt-5"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium text-base">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const testDetails: TestDetail[] = formatTestDetails();

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-2xl font-bold text-gray-800 mb-3">{testInfo.name}</Text>

          <View className="flex-row flex-wrap mb-4 gap-2">
            {isCompleted && (
              <View className="bg-emerald-500 py-1 px-2 rounded flex-row items-center gap-1">
                <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                <Text className="text-xs font-semibold text-white">DONE</Text>
              </View>
            )}
          </View>

          <View className="flex-row justify-around pt-2 border-t border-gray-100">
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-800">{testInfo.totalUserAttempt}</Text>
              <Text className="text-sm text-gray-500">Attempts</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-800">{testInfo.totalScore}</Text>
              <Text className="text-sm text-gray-500">Max Score</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Test Details</Text>
          {testDetails.map((detail, index) => (
            // Use items-start for better alignment if text wraps to multiple lines
            <View key={index} className="flex-row justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
              <Text className="text-base text-gray-500 mr-4">{detail.label}:</Text>

              <Text className="flex-1 text-base text-gray-800 font-medium text-right">
                {detail.value}
              </Text>

            </View>
          ))}
        </View>

        <TouchableOpacity
          className={`${isCompleted ? 'bg-emerald-600' : 'bg-blue-500'} rounded-xl py-4 mb-6 flex-row justify-center items-center gap-2 shadow-sm`}
          onPress={handleStartTest}
        >
          <Ionicons
            name={isCompleted ? "refresh" : "play-circle-outline"}
            size={20}
            color="#ffffff"
          />
          <Text className="text-lg font-semibold text-white">
            {isCompleted ? 'Take Test Again' : 'Start Test'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className={`${isCompleted ? 'bg-emerald-600' : 'bg-blue-500'} rounded-xl py-4 mb-6 flex-row justify-center items-center gap-2 shadow-sm`}
          onPress={handleGetDraft}
        >
          <Feather 
            name={"save"} 
            size={20} 
            color="#ffffff" 
          />
          <Text className="text-lg font-semibold text-white">
            Draft List
          </Text>
        </TouchableOpacity>
        
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          {currentUserId ? (
            <CommentSystem
              targetType={CommentTargetType.TEST}
              targetId={testId as string}
              currentUserId={currentUserId}
              userAvatarUrl={userAvatarUrl}
            />
          ) : (
            <View className="py-5 items-center justify-center">
              <Text>Please log in to view comments</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}