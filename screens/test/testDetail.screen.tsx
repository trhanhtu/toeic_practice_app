import React, { useEffect, useState, useCallback, useRef } from "react";
import QuestionDisplay from "@/components/common/question/QuestionDisplay";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View, TouchableOpacity, Alert, Modal, FlatList, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuestions } from "@/context/QuestionContext";
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import testService from "@/services/test.service";
import questionService from "@/services/question.service";
import { AnswerPair } from "@/types/global.type";
import FloatingChatButton from "@/components/common/button/FloatingChatButton";
import FloatingDictionary from "@/components/common/button/FloatingDictionary";
import { useDraft } from "@/hooks/useDraft";

export default function TestDetailScreen() {
  const { partNum, questionId, testId } = useLocalSearchParams();
  const router = useRouter();
  const {
    currentQuestion,
    currentIndex,
    questions,
    totalQuestions, // Sử dụng từ context thay vì hard-code
    setQuestions,
    goToNextQuestion,
    goToPreviousQuestion,
    setCurrentQuestionIndex
  } = useQuestions();

  const {
    saveDraft,
    loadDraft,
    deleteDraft,
    isDraftExists,
    loading: draftLoading,
    error: draftError
  } = useDraft();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState("Loading test");
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);
  const [hasDraftLoaded, setHasDraftLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  // Initialize submittedAnswers with empty strings for all questions when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && !hasDraftLoaded && !isInitialized) {
      const initialAnswers: Record<string, string> = {};

      questions.forEach(question => {
        // Handle questions with subquestions
        if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
          question.subQuestions.forEach(subQuestion => {
            if (subQuestion.id) {
              initialAnswers[subQuestion.id] = "";
            }
          });
        } else if (question.id) {
          // Handle regular questions
          initialAnswers[question.id] = "";
        }
      });

      setSubmittedAnswers(initialAnswers);
      setIsInitialized(true);
    }
  }, [questions, hasDraftLoaded, isInitialized]);

  // Load draft when component mounts - only run once when questions are available
  useEffect(() => {
    const loadExistingDraft = async () => {
      if ((testId || partNum) && questions.length > 0 && !hasDraftLoaded) {
        try {
          const draft = await loadDraft(
            testId as string || 'part_test',
            partNum as string
          );

          if (draft) {
            setSubmittedAnswers(draft.submittedAnswers);
            setCurrentQuestionIndex(draft.currentQuestionIndex);
            setHasDraftLoaded(true);
            setIsInitialized(true);

            // Show draft loaded notification
            Alert.alert(
              "Draft Loaded",
              `Your previous progress has been restored. You had answered ${draft.answeredCount} out of ${draft.totalQuestions} questions.`,
              [{ text: "Continue", style: "default" }]
            );
          } else {
            // No draft found, initialize normally
            setHasDraftLoaded(true);
          }
        } catch (err) {
          console.error('Error loading draft:', err);
          setHasDraftLoaded(true); // Set to true even on error to prevent infinite loop
        }
      }
    };

    loadExistingDraft();
  }, [testId, partNum, questions.length, hasDraftLoaded]);

  // Handle back button press and exit confirmation
  const handleBackPress = useCallback(() => {
    if (testCompleted) {
      return false;
    }

    const answeredCount = Object.values(submittedAnswers).filter(answer => answer !== "").length;

    if (answeredCount > 0) {
      Alert.alert(
        "Save Progress?",
        `You have answered ${answeredCount} questions. Would you like to save your progress before leaving?`,
        [
          {
            text: "Don't Save",
            onPress: () => {
              if (testId || partNum) {
                deleteDraft(
                  testId as string || 'part_test',
                  partNum as string
                ).catch(err => console.error('Error deleting draft:', err));
              }
              router.back();
            },
            style: "destructive"
          },
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Save & Exit",
            onPress: async () => {
              try {
                await saveDraft({
                  testId: testId as string || 'part_test',
                  partNum: partNum as string,
                  submittedAnswers,
                  currentQuestionIndex: currentIndex,
                  totalQuestions, // Sử dụng từ context
                  answeredCount
                });

                Alert.alert(
                  "Progress Saved",
                  "Your progress has been saved successfully.",
                  [{
                    text: "OK",
                    onPress: () => router.back()
                  }]
                );
              } catch (err) {
                console.error('Error saving draft:', err);
                Alert.alert(
                  "Save Error",
                  "Failed to save your progress, but you can still exit.",
                  [
                    { text: "Exit Anyway", onPress: () => router.back() },
                    { text: "Stay", style: "cancel" }
                  ]
                );
              }
            }
          }
        ]
      );
    } else {
      router.back();
    }

    return true;
  }, [testCompleted, submittedAnswers, testId, partNum, currentIndex, totalQuestions, saveDraft, deleteDraft, router]);


  // Set up back handler
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => backHandler.remove();
    }, [handleBackPress])
  );

  // Fetch questions when screen loads or params change
  useFocusEffect(
    useCallback(() => {
      if (partNum) {
        fetchQuestionsByPart(partNum as string);
      } else if (testId) {
        fetchQuestionsByTest(testId as string);
      }
    }, [partNum, testId])
  );

  // Set specific question as current if questionId is provided
  useEffect(() => {
    if (questionId && questions.length > 0 && isInitialized) {
      const index = questions.findIndex(q => q.id === questionId);
      if (index >= 0) {
        setCurrentQuestionIndex(index);
      }
    }
  }, [questions, questionId, isInitialized]);

  // Fetch questions by part number
  const fetchQuestionsByPart = async (partNumber: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await questionService.getAllQuestions({
        pageSize: 999, // Fetch all questions at once
        partNum: partNumber,
        current: 1,
      });

      if (response.data && response.data.length > 0) {
        setQuestions(response.data);
      } else {
        setError('No questions found for this part.');
      }
    } catch (err) {
      console.error('Error fetching questions by part:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch questions by test ID
  const fetchQuestionsByTest = async (testId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await testService.getTestQuestions(testId);

      if (response.data && response.data.listMultipleChoiceQuestions.length > 0) {
        setQuestions(response.data.listMultipleChoiceQuestions);
      } else {
        setError('No questions found for this test.');
      }
    } catch (err) {
      console.error('Error fetching questions by test:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelection = (qid: string, answer: string) => {
    if (!currentQuestion) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Store the answer
    setSubmittedAnswers(prev => ({
      ...prev,
      [qid]: answer
    }));
  };

  const handleNext = () => {
    goToNextQuestion();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePrevious = () => {
    goToPreviousQuestion();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmitTest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if all questions are answered
    const answeredCount = Object.values(submittedAnswers).filter(answer => answer !== "").length;
    const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    if (answeredCount < totalQuestions) {
      // Show confirmation alert if not all questions are answered
      Alert.alert(
        "Incomplete",
        `You have completed ${answeredCount}/${totalQuestions} questions. Are you sure you want to submit the test?`,
        [
          {
            text: "View unanswered questions",
            onPress: () => setQuestionsModalVisible(true),
            style: "cancel"
          },
          {
            text: "Submit",
            onPress: () => processSubmitTest()
          }
        ]
      );
    } else {
      // If all questions are answered, submit directly
      processSubmitTest();
    }
  };

  const processSubmitTest = async () => {
    console.log("Submitting test:", { testId });
    setLoadingText("Grading test");
    setLoading(true);

    try {
      // Build consistent answers array for all questions (regular and subquestions)
      const answers: AnswerPair[] = [];

      // Process all questions 
      questions.forEach((question) => {
        // Check if this question has subquestions
        if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
          // Add entries for each subquestion
          question.subQuestions.forEach(subQuestion => {
            const subQuestionId = subQuestion.id || '';
            answers.push({
              questionId: subQuestionId,
              userAnswer: submittedAnswers[subQuestionId] || '',
              timeSpent: 0
            });
          });
        } else {
          // Regular question without subquestions
          const questionId = question.id || '';
          answers.push({
            questionId: questionId,
            userAnswer: submittedAnswers[questionId] || '',
            timeSpent: 0
          });
        }
      });

      // Log the actual payload for debugging
      console.log("Submitting:", JSON.stringify({
        testId,
        userAnswer: answers,
        parts: '1234567',
        type: 'fulltest',
        totalSeconds: 0
      }, null, 2));

      // Submit test answers
      const submitResponse = await testService.submitTest({
        userAnswer: answers,
        testId: testId as string,
        totalSeconds: 0,
        parts: '1234567',
        type: 'fulltest'
      });

      // Check for successful response
      if (submitResponse.success) {
        setTestCompleted(true);

        // Delete draft after successful submission
        try {
          await deleteDraft(
            testId as string || 'part_test',
            partNum as string
          );
        } catch (draftErr) {
          console.error('Error deleting draft after submission:', draftErr);
        }

        Alert.alert("Success", "Test submitted successfully");

        const resultData = submitResponse.data;

        // Navigate to result page
        await router.push({
          pathname: '/(main)/result',
          params: { resultId: resultData.resultId },
        });
      } else {
        throw new Error(submitResponse.message || "Unknown error");
      }
    } catch (err) {
      console.error('Error submitting test:', err);
      Alert.alert("Error", `An error occurred while submitting the test: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingText("Loading test");
    }
  };

  // Function to determine if a question is answered
  const isQuestionAnswered = (question) => {
    if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
      // For questions with subquestions, check if all subquestions are answered
      return question.subQuestions.every(subQuestion =>
        subQuestion.id && submittedAnswers[subQuestion.id] !== "");
    } else {
      // For regular questions
      return question.id && submittedAnswers[question.id] !== "";
    }
  };

  const navigateToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setQuestionsModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Add manual save draft function for user-initiated saves
  const handleManualSaveDraft = async () => {
    try {
      const answeredCount = Object.values(submittedAnswers).filter(answer => answer !== "").length;

      await saveDraft({
        testId: testId as string || 'part_test',
        partNum: partNum as string,
        submittedAnswers,
        currentQuestionIndex: currentIndex,
        totalQuestions, // Sử dụng từ context
        answeredCount
      });

      Alert.alert(
        "Progress Saved",
        `Your progress has been saved successfully. You have answered ${answeredCount} out of ${totalQuestions} questions.`,
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error('Error saving draft:', err);
      Alert.alert("Save Error", "Failed to save your progress. Please try again.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <LottieView
          source={require('@/assets/animations/loading.json')}
          autoPlay
          loop
          style={{ width: 120, height: 120 }}
        />
        <Text className="text-base text-gray-600 mt-4">{loadingText}</Text>
        {draftLoading && (
          <Text className="text-sm text-blue-600 mt-2">Loading saved progress...</Text>
        )}
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
        <Text className="text-xl font-semibold text-gray-800 mt-4">Error Loading Questions</Text>
        <Text className="text-base text-gray-600 text-center mx-8 mt-2">{error}</Text>
        <TouchableOpacity
          className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
          onPress={() => {
            if (partNum) fetchQuestionsByPart(partNum as string);
            else if (testId) fetchQuestionsByTest(testId as string);
          }}
        >
          <Text className="text-white font-medium">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-gray-600">No questions available</Text>
      </SafeAreaView>
    );
  }

  // Function to get the relevant selectedAnswer for the current question
  const getFilteredAnswersForCurrentQuestion = () => {
    if (!currentQuestion) return {} as Record<string, string>;

    // For questions with subquestions
    if (currentQuestion.subQuestions && Array.isArray(currentQuestion.subQuestions) && currentQuestion.subQuestions.length > 0) {
      const filteredAnswers: Record<string, string> = {};
      currentQuestion.subQuestions.forEach(subQuestion => {
        const subQuestionId = subQuestion.id || '';
        if (submittedAnswers[subQuestionId] !== undefined) {
          filteredAnswers[subQuestionId] = submittedAnswers[subQuestionId];
        }
      });
      return filteredAnswers;
    }
    // For regular questions
    else {
      const questionId = currentQuestion.id || '';
      return submittedAnswers[questionId] !== undefined ? { [questionId]: submittedAnswers[questionId] } : {} as Record<string, string>;
    }
  };

  // Calculate completion percentage - consider only non-empty answers
  const answeredCount = Object.values(submittedAnswers).filter(answer => answer !== "").length;
  const progressPercentage = (answeredCount / 200) * 100;

  // Get filtered answers for the current question only
  const currentQuestionAnswers = getFilteredAnswersForCurrentQuestion();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4 mb-10">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Progress Bar and Navigation */}
          <View className="mb-6">
            {/* Progress indicator with draft status */}
            <View className="mb-2">
              <View className="flex-row justify-between mb-1">
                <View className="flex-row items-center">
                  <Text className="text-gray-600 font-medium">Test Progress</Text>
                  {hasDraftLoaded && (
                    <View className="ml-2 px-2 py-1 bg-blue-100 rounded-full">
                      <Text className="text-xs text-blue-600">Draft</Text>
                    </View>
                  )}
                </View>
                <Text className="text-gray-600">{answeredCount}/{totalQuestions} questions</Text>
              </View>
              <View className="h-2 bg-gray-200 rounded-full">
                <View
                  className="h-2 bg-blue-600 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
            </View>

            {/* Question counter */}
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Ionicons name="document-text-outline" size={16} color="#4B5563" />
                <Text className="ml-1 text-gray-600">
                  Question {currentIndex + 1} of {questions.length}
                </Text>
              </View>
              <Text className="text-gray-500">Part {currentQuestion.partNum}</Text>
            </View>

            {/* Navigation buttons */}
            <View className="flex-row justify-center space-x-2 gap-2 mb-3">
              <TouchableOpacity
                onPress={handlePrevious}
                disabled={currentIndex === 0}
                className={`flex-1 flex-row justify-center items-center py-2 rounded-lg ${currentIndex === 0 ? 'bg-gray-200' : 'bg-gray-300'
                  }`}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={currentIndex === 0 ? "#9CA3AF" : "#4B5563"}
                />
                <Text className={`ml-1 font-medium ${currentIndex === 0 ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                  Previous
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNext}
                disabled={currentIndex === questions.length - 1}
                className={`flex-1 flex-row justify-center items-center py-2 rounded-lg ${currentIndex === questions.length - 1 ? 'bg-gray-200' : 'bg-gray-300'
                  }`}
              >
                <Text className={`mr-1 font-medium ${currentIndex === questions.length - 1 ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                  Next
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={currentIndex === questions.length - 1 ? "#9CA3AF" : "#4B5563"}
                />
              </TouchableOpacity>

              {/* Questions list button */}
              <TouchableOpacity
                onPress={() => setQuestionsModalVisible(true)}
                className="py-2 px-3 bg-blue-100 rounded-lg flex-row justify-center items-center"
              >
                <Ionicons name="list" size={18} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            {/* Action buttons row */}
            <View className="flex-row justify-center space-x-2 gap-2">
              {/* Manual Save Draft Button */}
              <TouchableOpacity
                onPress={handleManualSaveDraft}
                className="flex-1 py-2 bg-orange-500 rounded-lg flex-row justify-center items-center"
              >
                <Ionicons name="save-outline" size={18} color="#ffffff" />
                <Text className="ml-1 font-medium text-white">
                  Save Draft
                </Text>
              </TouchableOpacity>

              {/* Submit Test Button */}
              <TouchableOpacity
                onPress={handleSubmitTest}
                className="flex-1 py-2 bg-green-600 rounded-lg flex-row justify-center items-center"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                <Text className="ml-1 font-medium text-white">
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Question Display */}
          <QuestionDisplay
            question={currentQuestion}
            displayQuestNum={false}
            onAnswerSelect={handleAnswerSelection}
            selectedAnswers={currentQuestionAnswers}
            key={currentQuestion.id} // Add key to force re-render when question changes
          />
        </ScrollView>

        {/* Questions Overview Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={questionsModalVisible}
          onRequestClose={() => setQuestionsModalVisible(false)}
        >
          <SafeAreaView className="flex-1 justify-center items-center bg-black bg-opacity-50">
            <View className="bg-white rounded-xl w-11/12 max-h-5/6 p-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">Questions List</Text>
                <TouchableOpacity onPress={() => setQuestionsModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View className="mb-4 bg-gray-100 p-3 rounded-lg">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-700">Completed:</Text>
                  <Text className="font-medium text-blue-600">{answeredCount}/{totalQuestions}</Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full">
                  <View
                    className="h-2 bg-blue-600 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </View>
              </View>

              {/* Use FlatList with explicit height to avoid layout issues */}
              <FlatList
                data={questions}
                className="mb-4"
                style={{ height: '70%' }}
                keyExtractor={(item, index) => item.id || index.toString()}
                renderItem={({ item, index }) => {
                  const isAnswered = isQuestionAnswered(item);
                  const isCurrentQuestion = index === currentIndex;

                  return (
                    <TouchableOpacity
                      onPress={() => navigateToQuestion(index)}
                      className={`flex-row items-center p-3 mb-2 rounded-lg ${isCurrentQuestion ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50'
                        }`}
                    >
                      <View className={`w-8 h-8 rounded-full mr-3 items-center justify-center ${isAnswered ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                        <Text className="text-white font-medium">{index + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-800 font-medium" numberOfLines={1}>
                          {item.question ?
                            (item.question.length > 40 ? item.question.substring(0, 40) + '...' : item.question) :
                            `Question ${index + 1}`}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <Text className="text-xs text-gray-500 mr-2">Part {item.partNum}</Text>
                          {isAnswered ? (
                            <View className="flex-row items-center">
                              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                              <Text className="text-xs text-green-600 ml-1">Answered</Text>
                            </View>
                          ) : (
                            <View className="flex-row items-center">
                              <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                              <Text className="text-xs text-amber-600 ml-1">Not answered</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#4B5563"
                      />
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                onPress={() => setQuestionsModalVisible(false)}
                className="py-3 bg-blue-600 rounded-lg items-center mt-auto"
              >
                <Text className="text-white font-medium">Return to test</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
      {/* Floating Chat Button */}
      {currentQuestion?.id ? (
        <FloatingChatButton questionId={currentQuestion.id} />
      ) : null}
      {/* Floating dictionary */}
      <FloatingDictionary />
    </SafeAreaView>
  );
}