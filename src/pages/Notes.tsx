import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { generateSummary, generateFlashcards, generateQuiz } from '@/lib/gemini';
import { extractTextFromFile, createNote, indexNoteForRAG, getUserNotes, deleteNote } from '@/services/notesService';
import { getCurrentUserId } from '@/lib/auth';
import { TranslatedText } from '@/components/TranslatedText';
import { useTranslatedText } from '@/hooks/useTranslation';
import { generateTimeAwareRecommendations, getTimeCategory } from '@/services/timeAwareService';
import type { TimeAwareRecommendation } from '@/services/timeAwareService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Upload, FileText, Sparkles, Download, Loader2, Clock, BookOpen, Video, Target, RefreshCw, Trash2 } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export default function Notes() {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          const { notes } = await getUserNotes(userId);
          if (notes) setSavedNotes(notes);
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
      } finally {
        setIsLoadingNotes(false);
      }
    };
    loadNotes();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      // Extract text from file
      const extractedText = await extractTextFromFile(uploadedFile);
      setContent(extractedText);

      // Save note to database first — this must not be blocked by AI failures
      const userId = await getCurrentUserId();
      if (userId) {
        const { note } = await createNote(userId, uploadedFile.name, extractedText);

        if (note) {
          setSavedNotes((prev) => [note, ...prev]);

          // Index for RAG in the background
          indexNoteForRAG(userId, note.id, extractedText).catch((err) =>
            console.error('Background RAG indexing failed:', err)
          );
        }
      }

      toast({
        title: 'File processed',
        description: 'Your file has been uploaded and saved successfully.',
      });

      // Auto-generate summary in the background — don't block note saving
      setIsGeneratingSummary(true);
      generateSummary(extractedText)
        .then((summaryResult) => setSummary(summaryResult))
        .catch((err) => {
          console.error('Error generating summary:', err);
          toast({ title: 'Summary unavailable', description: 'AI is busy. Your note was saved. Try generating the summary later.', variant: 'destructive' });
        })
        .finally(() => setIsGeneratingSummary(false));
    } catch (error: any) {
      toast({
        title: 'Error processing file',
        description: error.message || 'Failed to process file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!content) {
      toast({
        title: 'No content',
        description: 'Please upload a file first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingFlashcards(true);
    try {
      const generatedFlashcards = await generateFlashcards(content);
      setFlashcards(generatedFlashcards);
      toast({
        title: 'Flashcards generated',
        description: `Generated ${generatedFlashcards.length} flashcards.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate flashcards.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!content) {
      toast({
        title: 'No content',
        description: 'Please upload a file first.',
        variant: 'destructive',
      });
      return;
    }

    if (quiz.length > 0) {
      toast({
        title: 'Quiz already generated',
        description: 'You can only generate one quiz at a time.',
        variant: 'warning',
      });
      return;
    }

    setIsGeneratingQuiz(true);
    try {
      const generatedQuiz = await generateQuiz(content);
      setQuiz(generatedQuiz);
      toast({
        title: 'Quiz generated',
        description: `Generated ${generatedQuiz.length} quiz questions.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate quiz.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [attemptedQuestions, setAttemptedQuestions] = useState<number[]>([]);
  const [quizReport, setQuizReport] = useState(null);

  const handleAnswerSelection = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
    if (!attemptedQuestions.includes(currentQuestionIndex)) {
      setAttemptedQuestions((prev) => [...prev, currentQuestionIndex]);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, quiz.length - 1));
  };

  const handlePreviousQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmitQuiz = () => {
    const correctAnswers = attemptedQuestions.filter(
      (index) => quiz[index].correctAnswer === selectedAnswer
    ).length;
    const totalQuestions = quiz.length;
    const wrongAnswers = totalQuestions - correctAnswers;

    setQuizReport({
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      attemptedQuestions: attemptedQuestions.length,
    });
  };

  const handleRetakeQuiz = () => {
    setQuizReport(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setAttemptedQuestions([]);
  };

  const handleLoadNote = (note: any) => {
    setContent(note.content);
    setSummary(note.summary || '');
    setFlashcards([]);
    setQuiz([]);
    setFile(null);
    toast({ title: 'Note loaded', description: `Loaded "${note.title}"` });
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await deleteNote(noteId);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      return;
    }
    setSavedNotes((prev) => prev.filter((n) => n.id !== noteId));
    toast({ title: 'Note deleted' });
  };

  const renderQuestionNavigation = () => (
    <div className="flex space-x-2">
      {quiz.map((_, index) => (
        <span
          key={index}
          className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${
            index === currentQuestionIndex
              ? 'bg-primary text-white'
              : attemptedQuestions.includes(index)
              ? 'bg-success/20 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
          onClick={() => setCurrentQuestionIndex(index)}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold"><TranslatedText text="Smart Notes" /></h1>
        </div>
      </motion.div>

      <Tabs defaultValue="my-notes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="my-notes"><TranslatedText text="My Notes" /></TabsTrigger>
          <TabsTrigger value="upload"><TranslatedText text="Upload" /></TabsTrigger>
          <TabsTrigger value="summary"><TranslatedText text="Summary" /></TabsTrigger>
          <TabsTrigger value="flashcards"><TranslatedText text="Flashcards" /></TabsTrigger>
          <TabsTrigger value="quiz"><TranslatedText text="Quiz" /></TabsTrigger>
          <TabsTrigger value="time-aware">Time-Aware</TabsTrigger>
        </TabsList>

        {/* My Notes Tab */}
        <TabsContent value="my-notes">
          <Card>
            <CardHeader>
              <CardTitle><TranslatedText text="My Saved Notes" /></CardTitle>
              <CardDescription>
                <TranslatedText text="All your uploaded notes are saved here. Click a note to load it." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : savedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    <TranslatedText text="No notes yet. Go to Upload to add your first note." />
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleLoadNote(note)}
                      >
                        <h3 className="font-medium">{note.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString()} &middot;{' '}
                          {note.content?.length > 100
                            ? note.content.substring(0, 100) + '...'
                            : note.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle><TranslatedText text="Upload Your Notes" /></CardTitle>
              <CardDescription>
                <TranslatedText text="Upload PDFs, images, or documents. We'll extract and process the content." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
                <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold"><TranslatedText text="Upload your file" /></h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  <TranslatedText text="PDF, DOC, DOCX, JPG, PNG up to 20MB" />
                </p>
                <label htmlFor="file-upload">
                  <Button asChild>
                    <span><TranslatedText text="Choose File" /></span>
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                  />
                </label>
                {file && (
                  <div className="mt-4">
                    <p className="text-sm text-success">
                      ✓ {file.name} uploaded successfully
                    </p>
                    {isProcessing && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <TranslatedText text="Processing file..." />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle><TranslatedText text="AI-Generated Summary" /></CardTitle>
                  <CardDescription><TranslatedText text="Key points and main concepts from your notes" /></CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  <TranslatedText text="Export" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isGeneratingSummary ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground"><TranslatedText text="Generating summary with AI..." /></p>
                </div>
              ) : summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans">{summary}</pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    <TranslatedText text="Upload a file to generate a summary" />
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards">
          <Card>
            <CardHeader>
              <CardTitle><TranslatedText text="AI-Generated Flashcards" /></CardTitle>
              <CardDescription><TranslatedText text="Review key concepts with interactive flashcards" /></CardDescription>
            </CardHeader>
            <CardContent>
              {flashcards.length > 0 ? (
                <div className="space-y-4">
                  {flashcards.map((flashcard, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="mb-2 font-semibold">Q: <TranslatedText text={flashcard.question} /></div>
                        <div className="text-sm text-muted-foreground">
                          A: <TranslatedText text={flashcard.answer} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    <TranslatedText text={content ? "Click the button to generate flashcards from your notes" : "Upload a file first to generate flashcards"} />
                  </p>
                  <Button
                    className="mt-4"
                    disabled={!content || isGeneratingFlashcards}
                    onClick={handleGenerateFlashcards}
                  >
                    {isGeneratingFlashcards ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <TranslatedText text="Generating..." />
                      </>
                    ) : (
                      <TranslatedText text="Generate Flashcards" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz">
          {quiz.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle><TranslatedText text="AI-Generated Quiz" /></CardTitle>
                <CardDescription><TranslatedText text="Test your knowledge with adaptive quizzes" /></CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    <TranslatedText text={content ? "Click the button to generate a quiz from your notes" : "Upload a file first to generate a quiz"} />
                  </p>
                  <Button
                    className="mt-4"
                    disabled={!content || isGeneratingQuiz}
                    onClick={handleGenerateQuiz}
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <TranslatedText text="Generating..." />
                      </>
                    ) : (
                      <TranslatedText text="Generate Quiz" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {quiz.length > 0 && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <p className="text-lg font-semibold">Total Questions: {quiz.length}</p>
                {renderQuestionNavigation()}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="mb-6 text-lg font-semibold">{quiz[currentQuestionIndex].question}</p>
                  <ul className="space-y-4">
                    {quiz[currentQuestionIndex].options.map((option, index) => (
                      <li key={index}>
                        <Button
                          className="w-full text-left py-3 px-4"
                          variant={selectedAnswer === index ? 'secondary' : 'default'}
                          onClick={() => handleAnswerSelection(index)}
                          disabled={showExplanation}
                        >
                          {option}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {showExplanation && (
                    <div className="mt-6">
                      {selectedAnswer === quiz[currentQuestionIndex].correctAnswer ? (
                        <p className="text-green-500 text-lg">Correct!</p>
                      ) : (
                        <p className="text-red-500 text-lg">
                          Incorrect. Correct answer: {quiz[currentQuestionIndex].options[quiz[currentQuestionIndex].correctAnswer]}
                        </p>
                      )}
                      <p className="mt-4 text-base">{quiz[currentQuestionIndex].explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="flex justify-between mt-8">
                <Button className="px-6 py-3" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
                  Previous
                </Button>
                {currentQuestionIndex === quiz.length - 1 ? (
                  <Button className="px-6 py-3" onClick={handleSubmitQuiz}>
                    Submit
                  </Button>
                ) : (
                  <Button className="px-6 py-3" onClick={handleNextQuestion}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
          {quizReport && (
            <div className="mt-12">
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Report</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-lg font-semibold">Total Questions: {quizReport.totalQuestions}</p>
                  <p className="text-lg text-green-500">Correct Answers: {quizReport.correctAnswers}</p>
                  <p className="text-lg text-red-500">Wrong Answers: {quizReport.wrongAnswers}</p>
                  <p className="text-lg">Attempted Questions: {quizReport.attemptedQuestions}</p>
                  <Button className="mt-6 px-6 py-3" onClick={handleRetakeQuiz}>
                    Retake Quiz
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Time-Aware Learning Tab */}
        <TabsContent value="time-aware">
          <TimeAwareLearning />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Time-Aware Learning Component
function TimeAwareLearning() {
  const [timeValue, setTimeValue] = useState<string>('30');
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [subject, setSubject] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [recommendations, setRecommendations] = useState<TimeAwareRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Convert time to minutes for calculations
  const timeInMinutes = timeUnit === 'hours' 
    ? Number(timeValue) * 60 
    : Number(timeValue);
  
  const timeCategory = getTimeCategory(timeInMinutes || 30);

  const handleGenerate = async () => {
    if (!subject.trim()) {
      toast({
        title: 'Subject required',
        description: 'Please enter a subject or topic to learn.',
        variant: 'destructive',
      });
      return;
    }

    const timeMinutes = timeInMinutes;
    if (timeMinutes < 5 || timeMinutes > 480) {
      toast({
        title: 'Invalid time',
        description: 'Available time must be between 5 and 480 minutes (0.08 - 8 hours).',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateTimeAwareRecommendations({
        availableTime: timeMinutes,
        subject: subject.trim(),
        goal: goal.trim() || undefined,
      });
      setRecommendations(result);
      toast({
        title: 'Recommendations generated',
        description: `Generated ${result.length} personalized recommendations for your ${timeValue} ${timeUnit} session.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error generating recommendations',
        description: error.message || 'Failed to generate recommendations. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const totalDuration = recommendations.reduce((sum, rec) => sum + rec.duration, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Time-Aware Learning
          </CardTitle>
          <CardDescription>
            Get personalized study recommendations optimized for your available time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Time Input with Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="available-time">Available Study Time</Label>
              <div className="flex gap-2">
                <Input
                  id="available-time"
                  type="number"
                  min={timeUnit === 'hours' ? '0.08' : '5'}
                  max={timeUnit === 'hours' ? '8' : '480'}
                  step={timeUnit === 'hours' ? '0.5' : '1'}
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  placeholder={timeUnit === 'hours' ? '0.5' : '30'}
                  className="flex-1"
                />
                <Select value={timeUnit} onValueChange={(value: 'minutes' | 'hours') => setTimeUnit(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject Input */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject / Topic</Label>
              <Input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., React Hooks, Python Classes, Calculus"
              />
              <p className="text-xs text-muted-foreground">What would you like to learn?</p>
            </div>
          </div>

          {/* Learning Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">Learning Goal (Optional)</Label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Understand how to use React Hooks in a real project, Build a basic calculator app, Prepare for an exam on calculus fundamentals..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              What is your goal for learning this topic? This helps us personalize your recommendations.
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !subject.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating recommendations...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Personalized Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recommendations Display */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Your Study Plan</h3>
              <p className="text-sm text-muted-foreground">
                {recommendations.length} activities • Total: {totalDuration} minutes
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Badge
                          variant="outline"
                          className={`mb-2 ${
                            rec.type === 'concept'
                              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                              : rec.type === 'video'
                              ? 'border-red-500 text-red-600 dark:text-red-400'
                              : rec.type === 'practice'
                              ? 'border-green-500 text-green-600 dark:text-green-400'
                              : 'border-blue-500 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                        </Badge>
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {rec.duration}m
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{rec.description}</p>

                    {/* Resources */}
                    {rec.resources && rec.resources.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          Resources
                        </h4>
                        <ul className="space-y-1.5">
                          {rec.resources.map((resource, resIndex) => (
                            <li key={resIndex} className="text-xs">
                              {resource.url ? (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  {resource.type === 'video' && <Video className="h-3 w-3" />}
                                  {resource.type === 'article' && <FileText className="h-3 w-3" />}
                                  {resource.title}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">{resource.title}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tips */}
                    {rec.tips && rec.tips.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-1">
                          <Target className="h-3.5 w-3.5" />
                          Learning Tips
                        </h4>
                        <ul className="space-y-1.5">
                          {rec.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
