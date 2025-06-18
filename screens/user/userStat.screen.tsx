import useAuth from '@/hooks/useAuth';
import userService, { RecommendationResponse, RecommendedLecture, RecommendedTest } from "@/services/user.service";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';

// Types based on the actual API response structure
type OverallStat = {
  averageListeningScore: number;
  listeningScoreCount: number;
  averageReadingScore: number;
  readingScoreCount: number;
  averageTotalScore: number;
  totalScoreCount: number;
  averageTime: number;
  timeCount: number;
  highestScore: number;
};

type TopicStat = {
  topic: {
    name: string;
    solution: string;
    overallSkill: string;
    active: boolean;
  };
  totalCorrect: number;
  totalIncorrect: number;
  averageTime: number;
  timeCount: number;
  totalTime: number;
};

type SkillStat = {
  skill: string;
  totalCorrect: number;
  totalIncorrect: number;
  totalTime: number;
};

type Result = {
  createdAt: number;
  testId: string;
  resultId: string;
  testName: string;
  result: string;
  totalTime: number;
  totalReadingScore: number;
  totalListeningScore: number;
  totalCorrectAnswer: number;
  totalIncorrectAnswer: number;
  totalSkipAnswer: number;
  type: string;
  parts: string;
};

type AccountStats = {
  overallStat: OverallStat;
  topicStats: TopicStat[];
  skillStats: SkillStat[];
  results: Result[];
};

const StatScreen = () => {

  const defaultStat: AccountStats = {
    overallStat: {
      averageListeningScore: 0,
      listeningScoreCount: 0,
      averageReadingScore: 0,
      readingScoreCount: 0,
      averageTotalScore: 0,
      totalScoreCount: 0,
      averageTime: 0,
      timeCount: 0,
      highestScore: 0
    },
    topicStats: [],
    skillStats: [],
    results: []
  };

  // Get auth context
  const { user } = useAuth();
  // Manage loading state directly in component
  const [loading, setLoading] = useState(true); // Start with loading true
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [accountStat, setAccountStat] = useState<AccountStats>(defaultStat);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''); // Add error state
  const [recommendationError, setRecommendationError] = useState('');
  // Replace tab state with collapse states
  const [testsExpanded, setTestsExpanded] = useState(true);
  const [lecturesExpanded, setLecturesExpanded] = useState(true);
  const screenWidth = Dimensions.get('window').width;

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Using the direct overall stats from API rather than calculating
  const {
    averageListeningScore,
    averageReadingScore,
    averageTotalScore,
    totalScoreCount,
    highestScore
  } = accountStat.overallStat;

  // Calculate correct answers from skill stats
  const listeningSkill = accountStat.skillStats.find((s) => s.skill === 'listening');
  const readingSkill = accountStat.skillStats.find((s) => s.skill === 'reading');
  const listeningCorrect = listeningSkill?.totalCorrect || 0;
  const readingCorrect = readingSkill?.totalCorrect || 0;
  const totalCorrect = listeningCorrect + readingCorrect;

  // Calculate total questions attempted
  const listeningAttempted = (listeningSkill?.totalCorrect || 0) + (listeningSkill?.totalIncorrect || 0);
  const readingAttempted = (readingSkill?.totalCorrect || 0) + (readingSkill?.totalIncorrect || 0);
  const totalAttempted = listeningAttempted + readingAttempted;

  const pieChartData = [
    {
      name: 'Listening',
      population: listeningCorrect,
      color: '#4CAF50',
      legendFontColor: '#333',
      legendFontSize: 12
    },
    {
      name: 'Reading',
      population: readingCorrect,
      color: '#FFC107',
      legendFontColor: '#333',
      legendFontSize: 12
    },
  ];

  const fetchAccountStat = async () => {
    setError(''); // Reset error state before fetching
    try {
      console.log('Fetching account stats...');
      const response = await userService.getStat();
      console.log('Response received:', response);

      if (response && response.success && response.data) {
        // Extract directly from response data structure
        const userData = response.data;

        console.log('Setting account stats with data:', userData);
        setAccountStat({
          overallStat: userData.overallStat || defaultStat.overallStat,
          topicStats: userData.topicStats || [],
          skillStats: userData.skillStats || [],
          results: userData.results || []
        });
      } else {
        console.error('Invalid response format:', response);
        setError('Failed to load data. Invalid response format.');
      }
    } catch (error) {
      console.error('Error fetching stat:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setRefreshing(false);
      setLoading(false); // Always set loading to false when done
    }
  };

  const fetchRecommendation = async () => {
    setRecommendationError(''); // Reset error state before fetching
    try {
      console.log('Fetching recommendation data...');
      const response = await userService.getRecommendation();
      console.log('Recommendation response received:', response);

      if (response && response.success && response.data) {
        setRecommendation(response.data);
      } else {
        console.error('Invalid recommendation response format:', response);
        setRecommendationError('Failed to load recommendations. Invalid response format.');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendationError('Failed to load recommendations. Please try again.');
    } finally {
      setRecommendationLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Reset animations for refresh
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // Set loading states for refreshes
    setRecommendationLoading(true);

    // Fetch data
    fetchAccountStat();
    fetchRecommendation();
  };

  const loginRequiredPopup = () => {
    alert("Please log in");
    router.push('/(drawer)/(tabs)');
  };

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // Check if user is logged in
    if (user !== null) {
      // Set loading to true before fetching data
      setLoading(true);
      setRecommendationLoading(true);
      fetchAccountStat();
      fetchRecommendation();
    } else {
      setLoading(false);
      setRecommendationLoading(false);
      loginRequiredPopup();
    }
  }, [user]); // Add user as dependency to re-run if user changes

  // Modified to use direct function calls with params instead of navigation
  const navigateToTest = (testId: string) => {
    try {
      router.push({
        pathname: '/(main)/testInfo',
        params: { testId },
      });
    } catch (error) {
      console.error('Navigation error to test:', error);
      alert('Could not navigate to test details. Please try again.');
    }
  };

  // Modified to use direct function calls with params instead of navigation
  const navigateToLecture = (lectureId: string) => {
    try {
      router.push({
        pathname: '/(main)/lecture',
        params: { lectureId },
      });
    } catch (error) {
      console.error('Navigation error to lecture:', error);
      alert('Could not navigate to lecture details. Please try again.');
    }
  };

  const renderEmptyState = () => (
    <View className="items-center justify-center py-16">
      <LottieView
        source={require('@/assets/animations/reading.json')}
        autoPlay
        loop
        style={{ width: 120, height: 120 }}
      />
      <Text className="text-xl font-bold text-gray-800 mt-4 mb-2">
        No Statistics Available
      </Text>
      <Text className="text-base text-gray-600 text-center px-8">
        Complete some tests to view your performance statistics
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View className="mb-6 p-5 bg-[#004B8D] rounded-lg shadow-lg">
      {/* Overlay */}
      <View className="absolute inset-0 bg-black opacity-20 rounded-lg" />
      <View className="relative">
        <Text className="text-2xl font-bold text-white">
          Performance Statistics
        </Text>
        <Text className="text-sm text-white mt-2">
          View detailed insights about your test performance
        </Text>
      </View>
    </View>
  );

  // Modified to handle local state changes without navigation
  const renderRecommendationItem = (item: RecommendedTest | RecommendedLecture, type: 'test' | 'lecture') => (
    <TouchableOpacity
      key={item.id}
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        try {
          if (type === 'test') {
            navigateToTest(item.id);
          } else {
            navigateToLecture(item.id);
          }
        } catch (error) {
          console.error('Navigation error:', error);
          alert(`Could not navigate to ${type} details. Please try again.`);
        }
      }}
    >
      <View>
        <Text className="text-lg font-medium text-gray-800">{item.name}</Text>
        <Text className="text-sm text-gray-600 mt-1">{item.explanation}</Text>
      </View>
      <View className="flex-row items-center mt-2">
        <Ionicons
          name={type === 'test' ? 'clipboard-outline' : 'book-outline'}
          size={16}
          color="#6B7280"
        />
        <Text className="text-xs text-gray-500 ml-1">
          {type === 'test' ? 'Test' : 'Lecture'} • Tap to view details
        </Text>
      </View>
    </TouchableOpacity>
  );

  // New collapse section component
  const renderCollapsibleSection = (title: string, isExpanded: boolean, toggleExpanded: () => void, children: React.ReactNode, count: number) => (
    <View className="mb-4">
      <TouchableOpacity
        className="flex-row justify-between items-center bg-gray-100 rounded-lg p-3"
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          <Text className="text-lg font-medium text-gray-800">{title}</Text>
          <View className="ml-2 bg-gray-200 rounded-full px-2.5 py-0.5">
            <Text className="text-sm font-medium text-gray-700">{count}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View className="mt-2">
          {children}
        </View>
      )}
    </View>
  );

  const renderEmptyRecommendations = () => (
    <View className="items-center justify-center py-6">
      <Text className="text-center text-gray-500">
        No recommendations available at this time
      </Text>
    </View>
  );

  const renderRecommendations = () => (
    <View className="bg-white rounded-2xl shadow-lg p-5 mb-6">
      <Text className="text-xl font-semibold text-center text-gray-700 mb-4">
        Personalized Recommendations
      </Text>

      {recommendationLoading ? (
        <View className="items-center justify-center py-8">
          <LottieView
            source={require('@/assets/animations/loading.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
          <Text className="text-sm text-gray-500 mt-2">
            Loading recommendations...
          </Text>
        </View>
      ) : recommendationError ? (
        <View className="items-center justify-center py-6">
          <Text className="text-sm text-red-500 mb-2">{recommendationError}</Text>
          <Text
            className="text-blue-500 text-sm font-medium"
            onPress={() => {
              setRecommendationLoading(true);
              fetchRecommendation();
            }}
          >
            Tap to retry
          </Text>
        </View>
      ) : (
        <>
          {/* Recommended Tests Section */}
          {renderCollapsibleSection(
            "Recommended Tests",
            testsExpanded,
            () => setTestsExpanded(!testsExpanded),
            recommendation?.recommendedTests && recommendation.recommendedTests.length > 0 ? (
              recommendation.recommendedTests.map((test) => renderRecommendationItem(test, 'test'))
            ) : (
              renderEmptyRecommendations()
            ),
            recommendation?.recommendedTests?.length || 0
          )}

          {/* Recommended Lectures Section */}
          {renderCollapsibleSection(
            "Recommended Lectures",
            lecturesExpanded,
            () => setLecturesExpanded(!lecturesExpanded),
            recommendation?.recommendedLectures && recommendation.recommendedLectures.length > 0 ? (
              recommendation.recommendedLectures.map((lecture) => renderRecommendationItem(lecture, 'lecture'))
            ) : (
              renderEmptyRecommendations()
            ),
            recommendation?.recommendedLectures?.length || 0
          )}
        </>
      )}
    </View>
  );

  // Render each section with animations
  const renderStatItem = (index: any) => (
    <Animated.View
      key={`stat-item-${index}`}
      style={{
        transform: [
          { scale: scaleAnim },
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30 * index, 0]
            })
          }
        ],
        opacity: fadeAnim
      }}
    >
      {/* Test Statistics */}
      {index === 0 && (
        <View className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <Text className="text-xl font-semibold text-center text-gray-700 mb-4">
            Overall Performance
          </Text>
          <View className="py-2 border-b border-gray-100">
            <Text className="text-base text-gray-700">
              Total tests taken: <Text className="font-bold">{totalScoreCount}</Text>
            </Text>
          </View>
          <View className="py-2 border-b border-gray-100">
            <Text className="text-base text-gray-700">
              Average reading score: <Text className="font-bold">{averageReadingScore.toFixed(2)}</Text>
            </Text>
          </View>
          <View className="py-2 border-b border-gray-100">
            <Text className="text-base text-gray-700">
              Average listening score: <Text className="font-bold">{averageListeningScore.toFixed(2)}</Text>
            </Text>
          </View>
          <View className="py-2 border-b border-gray-100">
            <Text className="text-base text-gray-700">
              Average total score: <Text className="font-bold">{averageTotalScore.toFixed(2)}</Text>
            </Text>
          </View>
          <View className="py-2">
            <Text className="text-base text-gray-700">
              Highest score: <Text className="font-bold">{highestScore}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Recommendations */}
      {index === 1 && renderRecommendations()}

      {/* Pie Chart */}
      {index === 2 && (
        <View className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <Text className="text-xl font-semibold text-center text-gray-700 mb-4">
            Correct Answer Ratio
          </Text>
          {totalCorrect > 0 ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: '#f9f9f9',
                backgroundGradientFrom: '#f9f9f9',
                backgroundGradientTo: '#f9f9f9',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          ) : (
            <Text className="text-center text-gray-500 my-10">
              No answer data available
            </Text>
          )}
        </View>
      )}

      {/* Recent Results */}
      {index === 4 && accountStat.results.length > 0 && (
        <View className="bg-white rounded-2xl shadow-lg p-5 mb-20">
          <Text className="text-xl font-semibold text-center text-gray-700 mb-4">
            Recent Results
          </Text>
          <FlatList
            data={accountStat.results.slice(0, 5)}
            keyExtractor={(item) => item.resultId}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={async () => {
                  await router.push({
                    pathname: '/(main)/result',
                    params: { resultId: item.resultId },
                  });
                }}
                className="border-b border-gray-200 py-4"
              >
                <Text className="text-lg font-medium text-gray-800">{item.testName}</Text>
                <View className="flex-row justify-between mt-2">
                  <Text className="text-sm text-gray-600">Result: {item.result}</Text>
                  <Text className="text-sm text-gray-600">
                    Date: {new Date(item.createdAt * 1000).toLocaleDateString('en-US')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
    </Animated.View>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-100 px-4 pt-6 pb-20"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#004B8D']}
          tintColor={'#004B8D'}
          title={'Pull to refresh'}
          titleColor={'#6B7280'}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <View className="items-center justify-center py-16">
          <LottieView
            source={require('@/assets/animations/loading.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
          <Text className="text-lg text-gray-700 mt-4">
            Loading statistics...
          </Text>
        </View>
      ) : (
        <>
          {error ? (
            <View className="items-center justify-center py-16">
              <Text className="text-lg text-red-500 mb-4">{error}</Text>
              <Text
                className="text-blue-500 font-medium p-2"
                onPress={onRefresh}
              >
                Tap to retry
              </Text>
            </View>
          ) : (
            <>
              {user !== null && (
                <View className='flex-1'>
                  {renderHeader()}

                  {!accountStat ? renderEmptyState() : (
                    <>
                      {[0, 1, 2, 3, 4].map(index => renderStatItem(index))}
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default StatScreen;