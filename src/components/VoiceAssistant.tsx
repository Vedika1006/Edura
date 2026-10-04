import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { chatWithGemini } from '@/lib/gemini';
import { useUserStore } from '@/store/userStore';
import { Mic, MicOff, Volume2, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceAssistantProps {
  className?: string;
}

export function VoiceAssistant({ className }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleVoiceQuery = async (query: string) => {
    if (!query.trim()) return;

    setIsProcessing(true);
    setResponse('');

    try {
      // Add user message to history
      const userMessage = { role: 'user' as const, content: query };
      const updatedHistory = [...conversationHistory, userMessage];
      setConversationHistory(updatedHistory);

      // Get response from Gemini
      const aiResponse = await chatWithGemini(updatedHistory);
      
      setResponse(aiResponse);
      
      // Add assistant response to history
      setConversationHistory([...updatedHistory, { role: 'assistant', content: aiResponse }]);

      // Speak the response
      speakResponse(aiResponse);
    } catch (error: any) {
      console.error('Error processing voice query:', error);
      const errorMessage = error.message || 'Failed to get AI response. Please try again.';
      setResponse(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    if (!synthesisRef.current) return;

    // Cancel any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    synthesisRef.current.speak(utterance);
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      // Store final transcript for processing
      if (finalTranscript.trim()) {
        finalTranscriptRef.current = finalTranscript.trim();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Process the final transcript after recognition ends
      if (finalTranscriptRef.current) {
        const query = finalTranscriptRef.current;
        finalTranscriptRef.current = '';
        handleVoiceQuery(query);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      let errorMessage = 'Speech recognition error. Please try again.';
      if (event.error === 'no-speech') {
        errorMessage = 'No speech detected. Please try again.';
      } else if (event.error === 'audio-capture') {
        errorMessage = 'Microphone not found. Please check your microphone.';
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
      }
      
      toast({
        title: 'Voice Recognition Error',
        description: errorMessage,
        variant: 'destructive',
      });
    };


    recognitionRef.current = recognition;
    synthesisRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'Not Supported',
        description: 'Speech recognition is not supported in your browser. Please use Chrome or Edge.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTranscript('');
      setResponse('');
      recognitionRef.current.start();
      setIsOpen(true);
    } catch (error) {
      console.error('Error starting recognition:', error);
      toast({
        title: 'Error',
        description: 'Failed to start voice recognition. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const closeAssistant = () => {
    stopListening();
    stopSpeaking();
    setIsOpen(false);
    setTranscript('');
    setResponse('');
  };

  // Visual waveform animation for listening state
  const Waveform = () => (
    <div className="flex items-center justify-center gap-1 h-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-primary rounded-full"
          animate={{
            height: isListening ? [8, 20, 8] : 8,
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      {/* Floating Voice Button */}
      <motion.div
        className={cn('fixed bottom-6 right-6 z-50', className)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Button
          size="lg"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={isOpen ? closeAssistant : startListening}
          disabled={isProcessing}
        >
          {isListening ? (
            <MicOff className="h-6 w-6" />
          ) : isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </motion.div>

      {/* Voice Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]"
          >
            <Card className="shadow-2xl border-2">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Voice Assistant</h3>
                      <p className="text-xs text-muted-foreground">
                        {isListening ? 'Listening...' : isProcessing ? 'Processing...' : isSpeaking ? 'Speaking...' : 'Ready'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeAssistant}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Waveform Animation */}
                {isListening && (
                  <div className="mb-4 flex justify-center">
                    <Waveform />
                  </div>
                )}

                {/* Transcript */}
                {transcript && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1">You said:</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{transcript}</p>
                  </div>
                )}

                {/* Response */}
                {response && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground">Assistant:</p>
                      {isSpeaking && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        >
                          <Volume2 className="h-3 w-3 text-primary" />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-sm bg-primary/5 p-3 rounded-lg border border-primary/20">
                      {response}
                    </p>
                  </div>
                )}

                {/* Processing State */}
                {isProcessing && !response && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  {isListening ? (
                    <Button
                      onClick={stopListening}
                      variant="destructive"
                      className="flex-1"
                      size="sm"
                    >
                      <MicOff className="mr-2 h-4 w-4" />
                      Stop Listening
                    </Button>
                  ) : (
                    <Button
                      onClick={startListening}
                      className="flex-1"
                      size="sm"
                      disabled={isProcessing || isSpeaking}
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      Start Listening
                    </Button>
                  )}
                  
                  {isSpeaking && (
                    <Button
                      onClick={stopSpeaking}
                      variant="outline"
                      size="sm"
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  )}
                </div>

                {/* Conversation History Toggle */}
                {conversationHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Conversation History ({conversationHistory.length} messages)
                      </summary>
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {conversationHistory.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2 rounded text-xs',
                              msg.role === 'user'
                                ? 'bg-muted text-right'
                                : 'bg-primary/5 text-left'
                            )}
                          >
                            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>{' '}
                            {msg.content.substring(0, 100)}
                            {msg.content.length > 100 && '...'}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

