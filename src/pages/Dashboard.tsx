import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUserStore } from '@/store/userStore';
import { useTranslatedText } from '@/hooks/useTranslation';
import { TranslatedText } from '@/components/TranslatedText';
import { BookOpen, Brain, Target, Zap, Trophy, Clock, Loader2, RefreshCw, Sparkles, Activity, ArrowRight, Calendar, Star, Flame, GraduationCap, Layout } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUserId } from '@/lib/auth';
import { getUserProfile } from '@/services/userService';
import { getUserCourses, getCourseProgress, type Course } from '@/services/courseService';
import { supabase } from '@/lib/supabase';
import { generateDailyMotivation } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface CourseWithProgress extends Course {
  progress?: number;
  completedModules?: number;
}

export default function Dashboard() {
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    xp: 0,
    level: 1,
    streak: 0,
  });
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [totalCourses, setTotalCourses] = useState(0);
  const [todayModulesCompleted, setTodayModulesCompleted] = useState(0);
  const [todayGoal, setTodayGoal] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuote, setDailyQuote] = useState<string>('');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  const quickActions = [
    { icon: BookOpen, label: 'Browse Courses', color: 'text-primary', path: '/courses' },
    { icon: Brain, label: 'Ask AI Bot', color: 'text-accent', path: '/ai-bot' },
    { icon: Target, label: 'View Roadmap', color: 'text-success', path: '/roadmap' },
    { icon: Clock, label: 'Focus Session', color: 'text-destructive', path: '/focus' },
  ];

  // Translate all text strings
  const welcomeText = useTranslatedText('Welcome back');
  const readyText = useTranslatedText('Ready to continue your learning journey?');
  const totalXPText = useTranslatedText('Total XP');
  const levelText = useTranslatedText('Level');
  const coursesText = useTranslatedText('Courses');
  const streakText = useTranslatedText('Streak');
  const daysText = useTranslatedText('days');
  const quickActionsTitle = useTranslatedText('Quick Actions');
  const quickActionsDesc = useTranslatedText('Jump right into your learning activities');
  const yourCoursesTitle = useTranslatedText('Your Courses');
  const yourCoursesDesc = useTranslatedText('Continue where you left off');
  const modulesCompletedText = useTranslatedText('modules completed');
  const ofText = useTranslatedText('of');
  const continueText = useTranslatedText('Continue');
  const levelProgressTitle = useTranslatedText('Level Progress');
  const xpToLevelText = useTranslatedText('XP to Level');
  const todaysGoalTitle = useTranslatedText("Today's Goal");
  const todaysGoalDesc = useTranslatedText('Stay consistent to build your streak');
  const completeModulesText = useTranslatedText('Complete');
  const modulesText = useTranslatedText('modules');
  const startLearningText = useTranslatedText('Start Learning');

  useEffect(() => {
    loadDashboardData();
    
    // Listen for dashboard refresh events
    const handleRefresh = () => {
      loadDashboardData();
    };
    
    // Refresh when window regains focus (user returns to tab)
    const handleFocus = () => {
      loadDashboardData();
    };
    
    window.addEventListener('dashboard-refresh', handleRefresh);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Load daily quote when user data is available
  useEffect(() => {
    if (!isLoading && userData.xp !== undefined && userData.level !== undefined && userData.streak !== undefined) {
      loadDailyQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, userData.xp, userData.level, userData.streak, totalCourses, todayModulesCompleted, todayGoal]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        navigate('/login');
        return;
      }

      // Load user profile
      const profileResult = await getUserProfile(userId);
      let currentLevel = 1;
      if (profileResult.profile) {
        const profile = profileResult.profile;
        currentLevel = profile.level || 1;
        setUserData({
          xp: profile.xp || 0,
          level: currentLevel,
          streak: profile.streak || 0,
        });
        
        // Update user store
        useUserStore.setState({
          user: {
            name: profile.name || user?.name || '',
            email: profile.email || user?.email || '',
            xp: profile.xp || 0,
            level: currentLevel,
            streak: profile.streak || 0,
          },
        });
      }

      // Load courses with progress (courses the user has started)
      const { data: progressData, error: progressError } = await supabase
        .from('user_course_progress')
        .select(`
          *,
          courses (
            id,
            title,
            description,
            category,
            level,
            total_modules,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('last_accessed', { ascending: false })
        .limit(3);

      if (!progressError && progressData) {
        const coursesWithProgress = progressData
          .filter(item => item.courses) // Filter out null courses
          .map(item => ({
            ...(item.courses as Course),
            progress: item.progress_percentage || 0,
            completedModules: item.completed_modules || 0,
          }));
        
        setCourses(coursesWithProgress);
        setTotalCourses(coursesWithProgress.length);
      } else {
        // Fallback: also check user's own courses
        const coursesResult = await getUserCourses(userId);
        if (coursesResult.courses) {
          const coursesList = coursesResult.courses;
          setTotalCourses(coursesList.length);

          // Load progress for each course
          const coursesWithProgress = await Promise.all(
            coursesList.slice(0, 3).map(async (course) => {
              const progressResult = await getCourseProgress(course.id, userId);
              const progress = progressResult.progress;
              
              return {
                ...course,
                progress: progress?.progress_percentage || 0,
                completedModules: progress?.completed_modules || 0,
              };
            })
          );

          setCourses(coursesWithProgress);
        }
      }

      // Calculate today's completed modules
      await calculateTodayProgress(userId, currentLevel);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDailyQuote = async (forceRefresh = false) => {
    const storageKey = 'edura-daily-quote';
    const dateKey = 'edura-daily-quote-date';
    
    try {
      // Check if we have a cached quote for today
      const cachedDate = localStorage.getItem(dateKey);
      const today = new Date().toDateString();
      
      if (!forceRefresh && cachedDate === today) {
        const cachedQuote = localStorage.getItem(storageKey);
        if (cachedQuote) {
          setDailyQuote(cachedQuote);
          return;
        }
      }

      setIsQuoteLoading(true);

      const quote = await generateDailyMotivation({
        xp: userData.xp,
        level: userData.level,
        streak: userData.streak,
        coursesCount: totalCourses,
        todayGoal,
        todayProgress: todayModulesCompleted,
      });

      setDailyQuote(quote);
      
      // Cache the quote for today
      localStorage.setItem(storageKey, quote);
      localStorage.setItem(dateKey, today);
    } catch (error) {
      console.error('Error loading daily quote:', error);
      // Fallback quote
      setDailyQuote("Every step forward, no matter how small, is progress. Keep going.");
    } finally {
      setIsQuoteLoading(false);
    }
  };

  const calculateTodayProgress = async (userId: string, userLevel: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Get all course progress updated today
      const { data: progressData, error } = await supabase
        .from('user_course_progress')
        .select('completed_modules, updated_at')
        .eq('user_id', userId)
        .gte('updated_at', todayISO);

      if (error) {
        console.error('Error fetching today progress:', error);
        return;
      }

      // Count modules completed today
      // This is a simplified calculation - in a real app, you'd track module completions separately
      let modulesToday = 0;
      if (progressData && progressData.length > 0) {
        // For now, we'll estimate based on progress updates
        // In a real implementation, you'd have a separate table for module completions
        modulesToday = Math.min(progressData.length, 2); // Estimate
      }

      setTodayModulesCompleted(modulesToday);
      
      // Set goal based on user level (higher level = more modules)
      const goal = Math.max(2, Math.floor(userLevel / 2) + 1);
      setTodayGoal(goal);
    } catch (error) {
      console.error('Error calculating today progress:', error);
    }
  };

  // Calculate XP needed for next level
  const xpForNextLevel = 100; // 100 XP per level
  const currentLevelXP = userData.xp % xpForNextLevel;
  const xpNeeded = xpForNextLevel - currentLevelXP;
  const levelProgress = (currentLevelXP / xpForNextLevel) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 pb-12">
      {/* Decorative background elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="container relative z-10 px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {welcomeText}, {user?.name}! 👋
            </h1>
            <p className="text-muted-foreground text-lg">
              {readyText}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-card/50 backdrop-blur-sm p-2 rounded-full border shadow-sm"
          >
             <div className="bg-primary/10 p-2 rounded-full">
                <Flame className="h-5 w-5 text-primary" />
             </div>
             <div className="pr-4">
                <p className="text-sm font-medium">{userData.streak} {daysText}</p>
                <p className="text-xs text-muted-foreground">{streakText}</p>
             </div>
          </motion.div>
        </div>

        {/* Stats Grid - Aesthetic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* XP Card */}
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
             <Card className="border-none shadow-lg bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden h-full">
               <div className="absolute right-0 top-0 p-4 opacity-10">
                 <Zap className="h-24 w-24" />
               </div>
               <CardContent className="p-6 flex flex-col justify-between h-full">
                 <div className="space-y-2">
                   <div className="p-2 w-fit rounded-lg bg-primary/20 text-primary">
                     <Zap className="h-5 w-5" />
                   </div>
                   <h3 className="text-muted-foreground font-medium">{totalXPText}</h3>
                 </div>
                 <div className="mt-4">
                   <p className="text-4xl font-bold tracking-tight">{userData.xp}</p>
                   <p className="text-sm text-muted-foreground mt-1">Total Experience Points</p>
                 </div>
               </CardContent>
             </Card>
           </motion.div>

           {/* Level Card */}
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
             <Card className="border-none shadow-lg bg-gradient-to-br from-success/10 to-transparent relative overflow-hidden h-full">
               <div className="absolute right-0 top-0 p-4 opacity-10">
                 <Trophy className="h-24 w-24" />
               </div>
               <CardContent className="p-6 flex flex-col justify-between h-full">
                 <div className="space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="p-2 w-fit rounded-lg bg-success/20 text-success">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-success">Level {userData.level}</span>
                    </div>
                    <div>
                        <h3 className="text-muted-foreground font-medium">{levelProgressTitle}</h3>
                        <div className="flex items-end gap-2 mt-2">
                            <span className="text-4xl font-bold">{Math.floor(levelProgress)}%</span>
                            <span className="text-sm text-muted-foreground mb-1">to Level {userData.level + 1}</span>
                        </div>
                    </div>
                 </div>
                 <div className="mt-4">
                   <Progress value={levelProgress} className="h-2" />
                 </div>
               </CardContent>
             </Card>
           </motion.div>

           {/* Goals Card */}
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
             <Card className="border-none shadow-lg bg-gradient-to-br from-accent/10 to-transparent relative overflow-hidden h-full">
               <div className="absolute right-0 top-0 p-4 opacity-10">
                 <Target className="h-24 w-24" />
               </div>
               <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="space-y-2">
                   <div className="p-2 w-fit rounded-lg bg-accent/20 text-accent">
                     <Target className="h-5 w-5" />
                   </div>
                   <h3 className="text-muted-foreground font-medium">{todaysGoalTitle}</h3>
                 </div>
                 <div className="mt-4 space-y-3">
                   <div className="flex justify-between text-sm">
                     <span className="font-medium">{todayModulesCompleted} / {todayGoal} Modules</span>
                     <span className="text-muted-foreground">{Math.round((todayModulesCompleted / todayGoal) * 100)}%</span>
                   </div>
                   <Progress value={(todayModulesCompleted / todayGoal) * 100} className="h-2" />
                   <p className="text-xs text-muted-foreground">{todaysGoalDesc}</p>
                 </div>
               </CardContent>
             </Card>
           </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column - 8 cols */}
            <div className="lg:col-span-8 space-y-8">
                {/* Active Courses Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                             <Layout className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-bold">{yourCoursesTitle}</h2>
                        </div>
                        <Link to="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
                            Browse all <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {courses.length === 0 ? (
                        <Card className="border-dashed py-12">
                             <div className="text-center">
                                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium mb-2">No courses started yet</h3>
                                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                    Start your learning journey today by exploring our catalog of courses.
                                </p>
                                <Button asChild>
                                  <Link to="/courses">
                                    <TranslatedText text="Explore Courses" />
                                  </Link>
                                </Button>
                              </div>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {courses.map((course, index) => (
                                <motion.div
                                    key={course.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                >
                                    <Card className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300">
                                        <div className="flex flex-col md:flex-row">
                                            {/* Decorative colored strip or image placeholder */}
                                            <div className={cn(
                                                "h-32 md:h-auto md:w-48 relative flex-shrink-0 flex items-center justify-center", 
                                                // Generate a consistent random-ish color based on id/index
                                                index % 3 === 0 ? "bg-gradient-to-br from-blue-500 to-cyan-400" :
                                                index % 3 === 1 ? "bg-gradient-to-br from-purple-500 to-pink-400" :
                                                "bg-gradient-to-br from-orange-500 to-amber-400"
                                            )}>
                                                <GraduationCap className="h-12 w-12 text-white opacity-80" />
                                            </div>
                                            
                                            <CardContent className="flex-1 p-6">
                                                <div className="flex flex-col h-full justify-between gap-4">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary text-foreground/80">
                                                                {course.level}
                                                            </span>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                                <Star className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">{course.progress}% Completed</span>
                                                            <span className="text-muted-foreground">{course.completedModules}/{course.total_modules} Modules</span>
                                                        </div>
                                                        <Progress value={course.progress || 0} className="h-2" />
                                                    </div>
                                                    
                                                    <div className="flex justify-end pt-2">
                                                        <Button asChild size="sm" className="gap-2">
                                                          <Link to={`/courses/${course.id}`}>
                                                            {continueText} <ArrowRight className="h-4 w-4" />
                                                          </Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Right Column - 4 cols */}
            <div className="lg:col-span-4 space-y-8">
                 {/* Daily Quote Card */}
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                 >
                    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-amber-500" />
                                    Daily Wisdom
                                </CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => loadDailyQuote(true)}
                                  disabled={isQuoteLoading}
                                  className="h-8 w-8 p-0 hover:bg-transparent hover:text-primary"
                                >
                                  <RefreshCw className={cn("h-4 w-4", isQuoteLoading && "animate-spin")} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <span className="absolute -top-2 -left-2 text-4xl text-primary/20 font-serif">"</span>
                                {isQuoteLoading ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Consulting the AI...</span>
                                  </div>
                                ) : (
                                  <p className="text-md font-medium text-foreground italic leading-relaxed px-2 py-1">
                                    {dailyQuote}
                                  </p>
                                )}
                                <span className="absolute -bottom-4 -right-1 text-4xl text-primary/20 font-serif">"</span>
                            </div>
                        </CardContent>
                    </Card>
                 </motion.div>

                 {/* Quick Actions Grid */}
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                 >
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        {quickActionsTitle}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <Link key={action.label} to={action.path}>
                                <Card className="hover:bg-accent/5 transition-colors border-dashed hover:border-solid cursor-pointer h-full">
                                    <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 h-full">
                                        <div className={cn("p-2 rounded-full bg-background shadow-sm", action.color)}>
                                            <action.icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-sm font-medium"><TranslatedText text={action.label} /></span>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                 </motion.div>

                 {/* Focus/Time Widget */}
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                 >
                    <Card className="overflow-hidden relative">
                         <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10" />
                         <CardContent className="p-6 relative">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-primary/10 rounded-full">
                                    <Brain className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">Focus Mode</h4>
                                    <p className="text-xs text-muted-foreground">Ready to deep work?</p>
                                </div>
                            </div>
                            <Button className="w-full bg-primary/90 hover:bg-primary" asChild>
                                <Link to="/focus">
                                    Enter Focus Room
                                </Link>
                            </Button>
                         </CardContent>
                    </Card>
                 </motion.div>
            </div>
        </div>
      </div>
    </div>
  );
}
