import useAuth from "@/hooks/useAuth";
import categoryService from "@/services/category.service";
import { Test } from "@/types/global.type";
import { FontAwesome6, Ionicons, MaterialIcons, AntDesign } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FullScreenLoader } from "@/components/common/loader/LoadingComponent";

const ITEMS_PER_PAGE = 5;
const COMPLETED_TESTS_KEY = 'completed_tests';

export default function TestListScreen() {
  const router = useRouter();
  const { user, loading, toggleLoading } = useAuth();
  const { categoryId } = useLocalSearchParams();

  const [tests, setTests] = useState<Test[]>([]);
  const [page, setPage] = useState<number>(1);
  const [userTestIds, setUserTestIds] = useState<Set<string>>(new Set());
  const [loadingCompletedTests, setLoadingCompletedTests] = useState<boolean>(true);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Load completed tests from AsyncStorage
  const loadCompletedTests = async () => {
    setLoadingCompletedTests(true);
    try {
      const testsData = await AsyncStorage.getItem(COMPLETED_TESTS_KEY);
      if (testsData) {
        const parsedTestIds = JSON.parse(testsData);
        setUserTestIds(new Set(parsedTestIds));
      }
    } catch (error) {
      console.error('Error loading completed tests:', error);
    } finally {
      setLoadingCompletedTests(false);
    }
  };

  const handlePress = async (testId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Chỉ navigate đến màn hình testInfo, không lưu completed test ở đây nữa
    await router.push({
      pathname: '/(main)/testInfo',
      params: { testId },
    });
  };

  const fetchTests = async () => {
    toggleLoading();
    try {
      const { data: tests } = await categoryService.getAllTestsByCategory(categoryId as string);
      setTests(tests);
    } catch (err) {
      console.error('Error fetching tests:', err);
    } finally {
      toggleLoading();
    }
  };

  // Animation when component mounts
  useEffect(() => {
    const prepareData = async () => {
      // Start entrance animations
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
    };

    prepareData();
  }, []);

  // On mount
  useEffect(() => {
    fetchTests();
  }, [categoryId]);

  // On focus - Load completed tests để hiển thị status
  useFocusEffect(
    useCallback(() => {
      loadCompletedTests();
    }, [user])
  );

  // Get test difficulty color and icon
  const getTestDifficultyDetails = (test: Test) => {
    const score = test.totalScore || 0;

    if (score < 300) {
      return { color: '#4CAF50', bgColor: 'bg-green-100', textColor: 'text-green-700', type: 'Easy' };
    } else if (score < 600) {
      return { color: '#FF9800', bgColor: 'bg-orange-100', textColor: 'text-orange-700', type: 'Medium' };
    } else {
      return { color: '#F44336', bgColor: 'bg-red-100', textColor: 'text-red-700', type: 'Hard' };
    }
  };

  const renderTests = () => {
    const currentPage = page;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentPageTests = tests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (loading || loadingCompletedTests) {
      return (
        <FullScreenLoader />
      );
    }

    if (!tests.length) {
      return (
        <View className="items-center justify-center py-8">
          <LottieView
            source={require('@/assets/animations/reading.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
          <Text className="mt-2 text-base text-gray-600">No tests available</Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          data={currentPageTests}
          renderItem={({ item, index }) => {
            const testNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
            const difficulty = getTestDifficultyDetails(item);
            const isCompleted = userTestIds.has(item.id!);

            return (
              <Animated.View
                style={{
                  transform: [{ scale: fadeAnim }],
                  opacity: fadeAnim
                }}
                className="mb-2"
              >
                <TouchableOpacity
                  className={`flex-row items-center p-3 bg-white rounded-lg border border-gray-200 ${isCompleted ? 'border-l-4 border-l-green-500 bg-green-50' : ''}`}
                  onPress={() => handlePress(item.id!)}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                    <Text className="text-blue-600 font-bold text-base">{testNumber}</Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-gray-800 font-semibold text-base">
                        {item.name}
                      </Text>
                      {isCompleted && (
                        <View className="flex-row items-center bg-green-500 rounded-full px-2 py-0.5 ml-2">
                          <Ionicons name="checkmark-circle" size={14} color="#fff" />
                          <Text className="text-white text-xs font-medium ml-1">Done</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center mt-1">
                      <View className={`flex-row items-center ${difficulty.bgColor} px-2 py-0.5 rounded-md mr-2`}>
                        <MaterialIcons name={
                          difficulty.textColor.includes('green') ? "trending-down" :
                            difficulty.textColor.includes('orange') ? "trending-flat" : "trending-up"
                        } size={14} color={difficulty.color} />
                        <Text className={`${difficulty.textColor} text-xs ml-1`}>
                          {difficulty.type}
                        </Text>
                      </View>

                      <View className="flex-row items-center bg-gray-100 px-2 py-0.5 rounded-md mr-2">
                        <AntDesign name="questioncircleo" size={12} color="#666" />
                        <Text className="text-gray-600 text-xs ml-1">{item.totalQuestion} Questions</Text>
                      </View>

                      <View className="flex-row items-center bg-gray-100 px-2 py-0.5 rounded-md">
                        <AntDesign name="star" size={12} color="#666" />
                        <Text className="text-gray-600 text-xs ml-1">{item.totalScore} Point</Text>
                      </View>
                    </View>
                  </View>

                  <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
                    <FontAwesome6
                      name="file-circle-check"
                      size={18}
                      color="#004B8D"
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
          keyExtractor={(item) => item.id!}
          showsVerticalScrollIndicator={false}
        />

        <View className="flex-row justify-between items-center mt-4">
          <TouchableOpacity
            className={`flex-row items-center px-3 py-2 rounded-lg ${page === 1 ? 'bg-gray-200' : 'bg-blue-600'}`}
            onPress={() => {
              if (page > 1) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPage(page - 1);
              }
            }}
            disabled={page === 1}
          >
            <Ionicons name="chevron-back" size={16} color={page === 1 ? "#718096" : "#fff"} />
            <Text className={`ml-1 font-medium ${page === 1 ? 'text-gray-500' : 'text-white'}`}>
              Previous
            </Text>
          </TouchableOpacity>

          <Text className="text-gray-600">Page {page}</Text>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2 rounded-lg ${currentPageTests.length < ITEMS_PER_PAGE ? 'bg-gray-200' : 'bg-blue-600'}`}
            onPress={() => {
              if (currentPageTests.length >= ITEMS_PER_PAGE) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPage(page + 1);
              }
            }}
            disabled={currentPageTests.length < ITEMS_PER_PAGE}
          >
            <Text className={`mr-1 font-medium ${currentPageTests.length < ITEMS_PER_PAGE ? 'text-gray-500' : 'text-white'}`}>
              Next
            </Text>
            <Ionicons name="chevron-forward" size={16} color={currentPageTests.length < ITEMS_PER_PAGE ? "#718096" : "#fff"} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <View className="flex-1 p-4">
        {renderTests()}
      </View>
    </SafeAreaView>
  );
}