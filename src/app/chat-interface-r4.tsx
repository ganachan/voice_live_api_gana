"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AudioHandler } from "@/lib/audio";
import { ProactiveEventManager } from "@/lib/proactive-event-manager";
import { int16PCMToFloat32, downsampleBuffer, float32ToInt16PCM } from "@/lib/audioConverters";
import { Power, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AvatarConfigVideoParams,
  Voice,
  EOUDetection,
  isFunctionCallItem,
  Modality,
  RTClient,
  RTInputAudioItem,
  RTResponse,
  TurnDetection,
} from "rt-client";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import "./index.css";
import {
  clearChatSvg,
  offSvg,
  recordingSvg,
  robotSvg,
  settingsSvg,
} from "./svg";
import * as speechSDK from "microsoft-cognitiveservices-speech-sdk";

interface Message {
  type: "user" | "assistant" | "status" | "error";
  content: string;
}

interface ToolDeclaration {
  type: "function";
  name: string;
  parameters: object | null;
  description: string;
}

interface SystemToolDeclaration{
   type: string;
   description: string;
}

interface IndustryScenario {
  name: string;
  instructions?: string;
  pro_active?: boolean;
  voice?: {
    custom_voice: boolean;
    deployment_id?: string;
    voice_name: string;
    temperature?: number;
    speed?: number;
  };
  avatar?: {
    enabled: boolean;
    customized: boolean;
    avatar_name: string;
  };
}

interface AudioChunksForPA {
  audioBuffer: ArrayBuffer;
  timestamp: number;
}

// Custom Enhanced Switch Component for better visibility
const EnhancedSwitch = ({ checked, onCheckedChange, disabled, label }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-white/80 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <div className="flex items-center space-x-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
          checked 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-400 text-white'
        }`}>
          {checked ? 'ON' : 'OFF'}
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={`
            ${checked 
              ? 'data-[state=checked]:bg-green-600 border-green-600' 
              : 'data-[state=unchecked]:bg-gray-400 border-gray-400'
            }
            data-[state=checked]:border-green-600
            data-[state=unchecked]:border-gray-400
            transition-colors
          `}
        />
      </div>
    </div>
  );
};

// Define predefined tool templates
const predefinedTools = [
  {
    id: "language_detection",
    label: "[System] Language Detection",
    is_system_tool: true,
    tool: {
      type: "language_detection",
    } as SystemToolDeclaration,
    enabled: true,
  },
  {
    id: "search",
    label: "Search",
    tool: {
      type: "function",
      name: "search",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      description:
        "Search the knowledge base. The knowledge base is in English, translate to and from English if " +
        "needed. Results are formatted as a source name first in square brackets, followed by the text " +
        "content, and a line with '-----' at the end of each result.",
    } as ToolDeclaration,
    enabled: true,
  },
  {
    id: "time",
    label: "Time Lookup",
    tool: {
      type: "function",
      name: "get_time",
      parameters: null,
      description: "Get the current time.",
    } as ToolDeclaration,
    enabled: true,
  },
  {
    id: "pronunciation_assessment",
    label: "Pronunciation Assessment",
    tool: {
      type: "function",
      name: "pronunciation_assessment",
      parameters: null,
      description:
        "Every time a user sends any message, this function should be called to handle the request.",
    } as ToolDeclaration,
    enabled: true,
  },
];

// Helper to map message type to class names.
const getMessageClassNames = (type: Message["type"]): string => {
  switch (type) {
    case "user":
      return "bg-blue-100 ml-auto max-w-[80%]";
    case "assistant":
      return "bg-gray-100 mr-auto max-w-[80%]";
    case "status":
      return "bg-yellow-200 mx-auto max-w-[80%]";
    default:
      return "bg-red-100 mx-auto max-w-[80%]";
  }
};

let peerConnection: RTCPeerConnection;

const defaultAvatar = "Lisa-casual-sitting";

// Define the list of available languages.
const availableLanguages = [
  { id: "auto", name: "Auto Detect" },
  { id: "en-US", name: "English (United States)" },
  { id: "zh-CN", name: "Chinese (China)" },
  { id: "de-DE", name: "German (Germany)" },
  { id: "en-GB", name: "English (United Kingdom)" },
  { id: "en-IN", name: "English (India)" },
  { id: "es-ES", name: "Spanish (Spain)" },
  { id: "es-MX", name: "Spanish (Mexico)" },
  { id: "fr-FR", name: "French (France)" },
  { id: "hi-IN", name: "Hindi (India)" },
  { id: "it-IT", name: "Italian (Italy)" },
  { id: "ja-JP", name: "Japanese (Japan)" },
  { id: "ko-KR", name: "Korean (South Korea)" },
  { id: "pt-BR", name: "Portuguese (Brazil)" },
];

// Define the updated list of available voices.
const availableVoices = [
  {
    id: "en-us-ava:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Ava (HD)",
  },
  {
    id: "en-us-steffan:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Steffan (HD)",
  },
  {
    id: "en-us-andrew:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Andrew (HD)",
  },
  {
    id: "zh-cn-xiaochen:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Xiaochen (HD)",
  },
  {
    id: "en-us-emma:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Emma (HD)",
  },
  {
    id: "en-us-emma2:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Emma (HD 2)",
  },
  {
    id: "en-us-andrew2:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Andrew (HD 2)",
  },
  {
    id: "de-DE-Seraphina:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Seraphina (HD)",
  },
  {
    id: "en-us-aria:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Aria (HD)",
  },
  {
    id: "en-us-davis:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Davis (HD)",
  },
  {
    id: "en-us-jenny:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Jenny (HD)",
  },
  {
    id: "ja-jp-masaru:DragonHDLatestNeural",
    name: "DragonHDLatestNeural, Masaru (HD)",
  },
  { id: "en-US-AvaMultilingualNeural", name: "Ava Multilingual" },
  {
    id: "en-US-AlloyTurboMultilingualNeural",
    name: "Alloy Turbo Multilingual",
  },
  { id: "en-US-AndrewNeural", name: "Andrew" },
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew Multilingual" },
  { id: "en-US-BrianMultilingualNeural", name: "Brian Multilingual" },
  { id: "en-US-EmmaMultilingualNeural", name: "Emma Multilingual" },
  {
    id: "en-US-NovaTurboMultilingualNeural",
    name: "Nova Turbo Multilingual",
  },
  { id: "zh-CN-XiaoxiaoMultilingualNeural", name: "Xiaoxiao Multilingual" },
  { id: "en-US-AvaNeural", name: "Ava" },
  { id: "en-US-JennyNeural", name: "Jenny" },
  { id: "zh-HK-HiuMaanNeural", name: "HiuMaan (Cantonese)" },
  { id: "mt-MT-JosephNeural", name: "Joseph (Maltese)" },
  { id: "zh-cn-xiaoxiao2:DragonHDFlashLatestNeural", name: "Xiaoxiao2 HDFlash" },
  { id: "zh-cn-yunyi:DragonHDFlashLatestNeural", name: "Yunyi HDFlash" },
  {
    id: "alloy",
    name: "Alloy (OpenAI)",
  },
  {
    id: "ash",
    name: "Ash (OpenAI)",
  },
  {
    id: "ballad",
    name: "Ballad (OpenAI)",
  },
  {
    id: "coral",
    name: "Coral (OpenAI)",
  },
  {
    id: "echo",
    name: "Echo (OpenAI)",
  },
  {
    id: "sage",
    name: "Sage (OpenAI)",
  },
  {
    id: "shimmer",
    name: "Shimmer (OpenAI)",
  },
  {
    id: "verse",
    name: "Verse (OpenAI)",
  },
];

const avatarNames = [
  "Harry-business",
  "Harry-casual",
  "Harry-youthful",
  "Jeff-business",
  "Jeff-formal",
  "Lisa-casual-sitting",
  "Lori-casual",
  "Lori-formal",
  "Lori-graceful",
  "Max-business",
  "Max-casual",
  "Max-formal",
  "Meg-business",
  "Meg-casual",
  "Meg-formal",
];

let intervalId: NodeJS.Timeout | null = null;

const ChatInterface = () => {
  const [apiKey, setApiKey] = useState("e7728fa2f8df41ec943223b90762f8cd");
  const [endpoint, setEndpoint] = useState("https://westus2.api.cognitive.microsoft.com/");
  const [entraToken, setEntraToken] = useState("");
  const clientAuth = useRef<
    | {
        getToken: (_: string) => Promise<{
          token: string;
          expiresOnTimestamp: number;
        }>;
        key?: undefined;
      }
    | {
        key: string;
        getToken?: undefined;
      }
  >({ key: "" });
  const [model, setModel] = useState("gpt-realtime");
  const [recognitionLanguage, setRecognitionLanguage] = useState("auto");
  const [customerName, setCustomerName] = useState("");
  const [useNS, setUseNS] = useState(false);
  const [useEC, setUseEC] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.9);
  const [voiceTemperature, setVoiceTemperature] = useState(0.9);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [useCNV, setUseCNV] = useState(false);
  const [voiceName, setVoiceName] = useState("en-US-AvaMultilingualNeural");
  const [customVoiceName, setCustomVoiceName] = useState("");
  const [avatarName, setAvatarName] = useState(defaultAvatar);
  const [customAvatarName, setCustomAvatarName] = useState("");
  const [voiceDeploymentId, setVoiceDeploymentId] = useState("");
  const [tools, setTools] = useState<(ToolDeclaration | SystemToolDeclaration)[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAvatar, setIsAvatar] = useState(false);
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [isDevelop, setIsDevelop] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  // Add new state variables for industry scenarios
  const [industryScenarios, setIndustryScenarios] = useState<
    Record<string, IndustryScenario>
  >({});
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [isSettings, setIsSettings] = useState(false);

  const referenceText = useRef<string>("");
  const audioChunksForPA = useRef<AudioChunksForPA[]>([]);
  const pauseDurations = useRef<number[]>([]);
  const lastPauseTimestamp = useRef<number | null>(null);
  const startRecordingTimestamp = useRef<number | null>(null);

  // Add mode state and agent fields
  const [mode, setMode] = useState<"model" | "agent">("model");
  const [agentProjectName, setAgentProjectName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const clientRef = useRef<RTClient | null>(null);
  const audioHandlerRef = useRef<AudioHandler | null>(null);
  const proactiveManagerRef = useRef<ProactiveEventManager | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const isUserSpeaking = useRef(false);
  const animationRef = useRef(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const isEnableAvatar = isAvatar && (avatarName || customAvatarName);

  // Fetch configuration from /config endpoint when component loads
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/config");
        if (response.status === 404) {
          setConfigLoaded(true);
          return;
        }

        const config = await response.json();
        if (config.endpoint) {
          setEndpoint(config.endpoint);
        }
        if (config.token) {
          setEntraToken(config.token);
        }
        // Updated to use industry_scenarios instead of pre_defined_scenarios
        if (config.industry_scenarios) {
          setIndustryScenarios(config.industry_scenarios);
        }
        // Parse agent configs from /config
        if (config.agent && config.agent.project_name) {
          setAgentProjectName(config.agent.project_name);
          if (Array.isArray(config.agent.agents)) {
            setAgents(config.agent.agents);
            // If only one agent, auto-select it
            if (config.agent.agents.length === 1) {
              setAgentId(config.agent.agents[0].id);
            }
          }
        }
        setConfigLoaded(true);
      } catch (error) {
        console.error("Failed to fetch config:", error);
        setConfigLoaded(true);
      }
    };

    fetchConfig();
  }, []);

  // Apply settings from an industry scenario
  const applyScenario = (scenarioKey: string) => {
    const scenario = industryScenarios[scenarioKey];
    if (!scenario) return;

    // Apply instructions
    if (scenario.instructions) {
      // Replace {customerName} placeholder with actual customer name
      const personalizedInstructions = scenario.instructions.replace(
        /{customerName}/g, 
        customerName || '[Customer Name]'
      );
      setInstructions(personalizedInstructions);
    }

    // Apply voice settings
    if (scenario.voice) {
      if (scenario.voice.custom_voice) {
        setUseCNV(true);
        if (scenario.voice.deployment_id) {
          setVoiceDeploymentId(scenario.voice.deployment_id);
        }
        if (scenario.voice.voice_name) {
          setCustomVoiceName(scenario.voice.voice_name);
        }
        if (scenario.voice.temperature) {
          setVoiceTemperature(scenario.voice.temperature);
        }
        if (scenario.voice.speed) {
          setVoiceSpeed(scenario.voice.speed);
        }
      } else {
        setUseCNV(false);
        if (scenario.voice.voice_name) {
          setVoiceName(scenario.voice.voice_name);
        }
      }
    }

    // Apply avatar settings
    if (scenario.avatar) {
      setIsAvatar(scenario.avatar.enabled);
      if (scenario.avatar.enabled) {
        setIsCustomAvatar(scenario.avatar.customized);
        if (scenario.avatar.customized) {
          setCustomAvatarName(scenario.avatar.avatar_name);
        } else {
          setAvatarName(scenario.avatar.avatar_name);
        }
      }
    } else {
      setIsAvatar(false);
    }

    // Update selected scenario
    setSelectedScenario(scenarioKey);
  };

  // Update instructions when customer name changes
  useEffect(() => {
    if (selectedScenario && customerName) {
      applyScenario(selectedScenario);
    }
  }, [customerName, selectedScenario]);

  const handleConnect = async () => {
    if (!isConnected) {
      try {
        setIsConnecting(true);

        // Refresh the token before connecting
        if (configLoaded) {
          try {
            const response = await fetch("/config");
            if (response.ok) {
              const config = await response.json();
              if (config.endpoint) {
                setEndpoint(config.endpoint);
              }
              if (config.token) {
                setEntraToken(config.token);
              }
            }
          } catch (error) {
            console.error("Failed to refresh token:", error);
            // Continue with existing token if refresh fails
          }
        }

        // Use agent fields if in agent mode
        clientAuth.current = entraToken
          ? {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            getToken: async (_: string) => ({
              token: entraToken,
              expiresOnTimestamp: Date.now() + 3600000,
              }),
            }
          : { key: apiKey };
        if (mode === "agent" && !agentId) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              type: "error",
              content: "Please input/select an agent.",
            },
          ]);
          return;
        }
        clientRef.current = new RTClient(
          new URL(endpoint),
          clientAuth.current,
          mode === "agent"
            ? {
                modelOrAgent: {
                  agentId,
                  projectName: agentProjectName,
                  agentAccessToken: entraToken,
                },
                apiVersion: "2025-05-01-preview",
              }
            : {
                modelOrAgent: model,
                apiVersion: "2025-05-01-preview",
              }
        );
        console.log("Client created:", clientRef.current.connectAvatar);
        const modalities: Modality[] = ["text", "audio"];
        const turnDetection: TurnDetection = {
          type: "server_vad",
        };

        const voice: Voice = useCNV
          ? {
              name: customVoiceName,
              endpoint_id: voiceDeploymentId,
              temperature: customVoiceName.toLowerCase().includes("dragonhd")
                ? voiceTemperature
                : undefined,
              rate: voiceSpeed.toString(),
              type: "azure-custom",
            }
          : voiceName.includes("-")
            ? {
                name: voiceName,
                type: "azure-standard",
                temperature: voiceName.toLowerCase().includes("dragonhd")
                  ? voiceTemperature
                  : undefined,
                rate: voiceSpeed.toString(),
              }
            : (voiceName as Voice);

        const session = await clientRef.current.configure({
          instructions: instructions?.length > 0 ? instructions : undefined,
          input_audio_transcription: {
            model: model.includes("gpt") && model.includes("realtime")
              ? "whisper-1"
              : "azure-speech",
            language:
              recognitionLanguage === "auto" ? undefined : recognitionLanguage,
          },
          turn_detection: turnDetection,
          voice: voice,
          avatar: getAvatarConfig(),
          tools,
          temperature,
          modalities,
          input_audio_noise_reduction: useNS
            ? {
                type: "azure_deep_noise_suppression",
              }
            : null,
          input_audio_echo_cancellation: useEC
            ? {
                type: "server_echo_cancellation",
              }
            : null,
        });
        if (session?.avatar) {
          await getLocalDescription(session.avatar?.ice_servers);
        }

        startResponseListener();
        // Start recording the session
        if (audioHandlerRef.current) {
          audioHandlerRef.current.startSessionRecording();
        }

        setIsConnected(true);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            type: "status",
            content:
              "Session started, click on the mic button to start conversation! debug id: " +
              session.id,
          },
        ]);

        setSessionId(session.id);

      } catch (error) {
        console.error("Connection failed:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            type: "error",
            content: "Error connecting to the server: " + error,
          },
        ]);
      } finally {
        setIsConnecting(false);
      }
    } else {
      clearVideo();
      await disconnect();
    }
  };

  const getAvatarConfig = () => {
    if (!isAvatar) {
      return undefined;
    }

    const videoParams: AvatarConfigVideoParams = {
      codec: "h264",
      crop: {
        top_left: [560, 0],
        bottom_right: [1360, 1080],
      },
    };

    if (isCustomAvatar && customAvatarName) {
      return {
        character: customAvatarName,
        customized: true,
        video: videoParams,
      };
    } else if (isAvatar && !isCustomAvatar) {
      return {
        character: avatarName.split("-")[0].toLowerCase(),
        style: avatarName.split("-").slice(1).join("-"),
        video: videoParams,
      };
    } else {
      return undefined;
    }
  };

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.close();
        clientRef.current = null;
        peerConnection = null as unknown as RTCPeerConnection;
        setIsConnected(false);
        audioHandlerRef.current?.stopStreamingPlayback();
        proactiveManagerRef.current?.stop();
        isUserSpeaking.current = false;
        audioHandlerRef.current?.stopRecordAnimation();
        audioHandlerRef.current?.stopPlayChunkAnimation();
        if (isRecording) {
          audioHandlerRef.current?.stopRecording();
          setIsRecording(false);
        }
        startRecordingTimestamp.current = null;
        pauseDurations.current = [];
        lastPauseTimestamp.current = null;

        // Stop recording and check if there's any recorded audio
        if (audioHandlerRef.current) {
          audioHandlerRef.current.stopSessionRecording();
          setHasRecording(audioHandlerRef.current.hasRecordedAudio());
        }
      } catch (error) {
        console.error("Disconnect failed:", error);
      }
    }
  };

  const handleResponse = async (response: RTResponse) => {
    for await (const item of response) {
      if (item.type === "message" && item.role === "assistant") {
        const message: Message = {
          type: item.role,
          content: "",
        };
        setMessages((prevMessages) => [...prevMessages, message]);
        for await (const content of item) {
          if (content.type === "text") {
            for await (const text of content.textChunks()) {
              message.content += text;
              setMessages((prevMessages) => {
                if (prevMessages[prevMessages.length - 1]?.content) {
                  prevMessages[prevMessages.length - 1].content =
                    message.content;
                }
                return [...prevMessages];
              });
            }
          } else if (content.type === "audio") {
            const textTask = async () => {
              for await (const text of content.transcriptChunks()) {
                message.content += text;
                setMessages((prevMessages) => {
                  if (prevMessages[prevMessages.length - 1]?.content) {
                    prevMessages[prevMessages.length - 1].content =
                      message.content;
                  }
                  return [...prevMessages];
                });
              }
            };
            const audioTask = async () => {
              audioHandlerRef.current?.stopStreamingPlayback();
              audioHandlerRef.current?.startStreamingPlayback();
              for await (const audio of content.audioChunks()) {
                audioHandlerRef.current?.playChunk(audio, async () => {
                  proactiveManagerRef.current?.updateActivity("agent speaking");
                });
              }
            };
            await Promise.all([textTask(), audioTask()]);
          }
        }
        referenceText.current = "";
        audioChunksForPA.current = [];
      } else if (isFunctionCallItem(item)) {
        await item.waitForCompletion();
        console.log("Function call output:", item);
        if (item.functionName === "get_time") {
          const formattedTime = new Date().toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
          });
          console.log("Current time:", formattedTime);
          await clientRef.current?.sendItem({
            type: "function_call_output",
            output: formattedTime,
            call_id: item.callId,
          });
          await clientRef.current?.generateResponse();
        }
      }
    }
    if (response.status === "failed") {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          type: "error",
          content: "Response failed:" + JSON.stringify(response.statusDetails),
        },
      ]);
    }
  };

  const handleInputAudio = async (item: RTInputAudioItem) => {
    isUserSpeaking.current = true;
    audioHandlerRef.current?.stopStreamingPlayback();
    await item.waitForCompletion();
    isUserSpeaking.current = false;
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        type: "user",
        content: item.transcription || "",
      },
    ]);
    referenceText.current = item.transcription || "";
    extractValidAudioFromItem(item);
  };

  function extractValidAudioFromItem(audioItem: RTInputAudioItem) {
    if (!audioItem.audioStartMillis || !audioItem.audioEndMillis) return null;

    audioChunksForPA.current = audioChunksForPA.current.filter(
      (c) =>
        c.timestamp >= audioItem.audioStartMillis! &&
        c.timestamp <= audioItem.audioEndMillis!,
    );
  }

  const startResponseListener = async () => {
    if (!clientRef.current) return;

    try {
      for await (const serverEvent of clientRef.current.events()) {
        if (serverEvent.type === "response") {
          await handleResponse(serverEvent);
        } else if (serverEvent.type === "input_audio") {
          proactiveManagerRef.current?.updateActivity("user start to speak");
          await handleInputAudio(serverEvent);
        }
      }
    } catch (error) {
      if (clientRef.current) {
        console.error("Response iteration error:", error);
      }
    }
  };

  const sendMessage = async () => {
    if (currentMessage.trim() && clientRef.current) {
      try {
        const temporaryStorageMessage = currentMessage;
        setCurrentMessage("");
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            type: "user",
            content: temporaryStorageMessage,
          },
        ]);
        referenceText.current = temporaryStorageMessage;

        await clientRef.current.sendItem({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: temporaryStorageMessage }],
        });
        await clientRef.current.generateResponse();
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  function cacheAudioChunksForPA(chunk: Uint8Array) {
    if (!audioHandlerRef.current) return;
    const floatData = int16PCMToFloat32(chunk);
    const downsampled = downsampleBuffer(
      floatData,
      audioHandlerRef.current.getSampleRate(),
      16000
    );
    const int16Buffer = float32ToInt16PCM(downsampled);
    const arrayBuffer = new ArrayBuffer(int16Buffer.length);
    new Uint8Array(arrayBuffer).set(int16Buffer);
    if (startRecordingTimestamp.current) {
      audioChunksForPA.current.push({
        audioBuffer: arrayBuffer,
        timestamp:
          Date.now() -
          pauseDurations.current.reduce((acc, curr) => acc + curr, 0) -
          startRecordingTimestamp.current
      });
    }
  }

  const toggleRecording = async () => {
    if (!isRecording && clientRef.current) {
      try {
        if (!startRecordingTimestamp.current) {
          startRecordingTimestamp.current = Date.now();
        }
        if (lastPauseTimestamp.current) {
          pauseDurations.current.push(Date.now() - lastPauseTimestamp.current);
        }
        if (!audioHandlerRef.current) {
          audioHandlerRef.current = new AudioHandler();
          await audioHandlerRef.current.initialize();
        }
        await audioHandlerRef.current.startRecording(async (chunk) => {
          cacheAudioChunksForPA(chunk);
          await clientRef.current?.sendAudio(chunk);
          if (isUserSpeaking.current) {
            proactiveManagerRef.current?.updateActivity("user speaking");
          }
        });
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    } else if (audioHandlerRef.current) {
      try {
        audioHandlerRef.current.stopRecording();
        audioHandlerRef.current.stopRecordAnimation();
        lastPauseTimestamp.current = Date.now();
        setIsRecording(false);
      } catch (error) {
        console.error("Failed to stop recording:", error);
      }
    }
  };

  const getLocalDescription = (ice_servers?: RTCIceServer[]) => {
    console.log("Received ICE servers" + JSON.stringify(ice_servers));

    peerConnection = new RTCPeerConnection({ iceServers: ice_servers });

    setupPeerConnection();

    peerConnection.onicegatheringstatechange = (): void => {
      if (peerConnection.iceGatheringState === "complete") {
      }
    };

    peerConnection.onicecandidate = (
      event: RTCPeerConnectionIceEvent
    ): void => {
      if (!event.candidate) {
      }
    };

    setRemoteDescription();
  };

  const setRemoteDescription = async () => {
    try {
      const sdp = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(sdp);

      // sleep 2 seconds to wait for ICE candidates to be gathered
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(clientRef.current);

      const remoteDescription = await clientRef.current?.connectAvatar(
        peerConnection.localDescription as RTCSessionDescription
      );
      await peerConnection.setRemoteDescription(
        remoteDescription as RTCSessionDescriptionInit
      );
    } catch (error) {
      console.error("Connection failed:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          type: "error",
          content: "Error establishing avatar connection: " + error,
        },
      ]);
    }
  };

  const setupPeerConnection = () => {
    clearVideo();

    peerConnection.ontrack = function (event) {
      const mediaPlayer = document.createElement(
        event.track.kind
      ) as HTMLMediaElement;
      mediaPlayer.id = event.track.kind;
      mediaPlayer.srcObject = event.streams[0];
      mediaPlayer.autoplay = true;
      videoRef?.current?.appendChild(mediaPlayer);
    };

    peerConnection.addTransceiver("video", { direction: "sendrecv" });
    peerConnection.addTransceiver("audio", { direction: "sendrecv" });

    peerConnection.addEventListener("datachannel", (event) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (e) => {
        console.log(
          "[" + new Date().toISOString() + "] WebRTC event received: " + e.data
        );
      };
      dataChannel.onclose = () => {
        console.log("Data channel closed");
      };
    });
    peerConnection.createDataChannel("eventChannel");
  };

  const clearVideo = () => {
    const videoElement = videoRef?.current;

    // Clean up existing video element if there is any
    if (videoElement?.innerHTML) {
      videoElement.innerHTML = "";
    }
  };

  const downloadRecording = () => {
    if (audioHandlerRef.current) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      audioHandlerRef.current.downloadRecording(
        `conversation-${timestamp}`,
        sessionId
      );
    }
  };

  useEffect(() => {
    const initAudioHandler = async () => {
      const handler = new AudioHandler();
      await handler.initialize();
      audioHandlerRef.current = handler;
    };

    initAudioHandler().catch(console.error);

    return () => {
      disconnect();
      audioHandlerRef.current?.close().catch(console.error);
    };
  }, []);

  useEffect(() => {
    const element = document.getElementById("messages-area");
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Function to detect mobile devices
    const checkForMobileDevice = () => {
      const userAgent = navigator.userAgent;
      const isMobileCheck =
        /iPad|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent
        );
      setIsMobile(isMobileCheck);
    };

    // Run the check when component mounts
    checkForMobileDevice();
  }, []);

  useEffect(() => {
    const element = animationRef.current;
    if (isConnected && element && !isEnableAvatar) {
      audioHandlerRef.current?.setCircleElement(element);
    } else {
      audioHandlerRef.current?.setCircleElement(null);
    }
  }, [isConnected, isEnableAvatar]);

  useEffect(() => {
    if (isConnected && isEnableAvatar && isRecording) {
      intervalId = setInterval(() => {
        for (let i = 0; i < 20; i++) {
          const ele = document.getElementById(`item-${i}`);
          const height = 50 * Math.sin((Math.PI / 20) * i) * Math.random();
          if (ele) {
            ele.style.transition = "height 0.15s ease";
            ele.style.height = `${height}px`;
          }
        }
      }, 150);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
  }, [isConnected, isEnableAvatar, isRecording]);

  function handleSettings() {
    if (settingsRef.current) {
      if (isSettings) {
        settingsRef.current.style.display = "block";
        setIsSettings(false);
      } else {
        settingsRef.current.style.display = "none";
        setIsSettings(true);
      }
    }
  }

  return (
    <div className="flex h-screen">
      {/* Parameters Panel */}
      <div
        className="w-80 bg-gray-50 p-4 flex flex-col border-r"
        ref={settingsRef}
      >
        <div className="flex-1 overflow-y-auto">
          <Accordion type="single" collapsible className="space-y-4">
            
            {/* Customer Information */}
            <AccordionItem value="customer-info">
              <AccordionTrigger className="text-lg font-semibold">
                Customer Information
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <Input
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={isConnected}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Industry Scenarios */}
            <AccordionItem value="industry-scenarios">
              <AccordionTrigger className="text-lg font-semibold">
                Industry Scenarios
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {/* Industry scenarios dropdown */}
                {Object.keys(industryScenarios).length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Select Industry Scenario
                    </label>
                    <Select
                      value={selectedScenario}
                      onValueChange={(value) => applyScenario(value)}
                      disabled={isConnected}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry scenario" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(industryScenarios).map(
                          ([key, scenario]) => (
                            <SelectItem key={key} value={key}>
                              {scenario.name || key}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Model instructions */}
                {mode === "model" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      AI Instructions
                    </label>
                    <textarea
                      className="w-full min-h-[100px] p-2 border rounded"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      disabled={isConnected}
                      placeholder="Instructions will be loaded when you select an industry scenario..."
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Conversation Settings */}
            <AccordionItem value="conversation">
              <AccordionTrigger className="text-lg font-semibold">
                Conversation Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                
                <Input
                  placeholder="Azure AI Services Endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  disabled={isConnected || configLoaded}
                />
                
                <Input
                  placeholder="Subscription Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isConnected}
                />

                {/* Recognition Language selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Recognition Language
                  </label>
                  <Select
                    value={recognitionLanguage}
                    onValueChange={setRecognitionLanguage}
                    disabled={isConnected}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Enhanced Switch Components */}
                <EnhancedSwitch
                  checked={useNS}
                  onCheckedChange={setUseNS}
                  disabled={isConnected}
                  label="Noise suppression"
                />
                
                <EnhancedSwitch
                  checked={useEC}
                  onCheckedChange={setUseEC}
                  disabled={isConnected}
                  label="Echo cancellation"
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Temperature ({temperature})
                  </label>
                  <Slider
                    value={[temperature]}
                    onValueChange={([value]) => setTemperature(value)}
                    min={0.6}
                    max={1.2}
                    step={0.1}
                    disabled={isConnected}
                  />
                </div>
                
                {/* Enhanced Use Custom Voice Switch */}
                <EnhancedSwitch
                  checked={useCNV}
                  onCheckedChange={setUseCNV}
                  disabled={isConnected}
                  label="Use Custom Voice"
                />

                {useCNV && (
                  <>
                    <Input
                      placeholder="Voice Deployment ID"
                      value={voiceDeploymentId}
                      onChange={(e) => setVoiceDeploymentId(e.target.value)}
                      disabled={isConnected}
                    />
                    <Input
                      placeholder="Voice"
                      value={customVoiceName}
                      onChange={(e) => setCustomVoiceName(e.target.value)}
                      disabled={isConnected}
                    />
                  </>
                )}
                {!useCNV && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <Select
                      value={voiceName}
                      onValueChange={setVoiceName}
                      disabled={isConnected}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {((useCNV &&
                  customVoiceName.toLowerCase().includes("dragonhd")) ||
                  (!useCNV &&
                    voiceName.toLowerCase().includes("dragonhd"))) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Voice Temperature ({voiceTemperature})
                    </label>
                    <Slider
                      value={[voiceTemperature]}
                      onValueChange={([value]) => setVoiceTemperature(value)}
                      min={0.0}
                      max={1.0}
                      step={0.1}
                      disabled={isConnected}
                    />
                  </div>
                )}
                {(useCNV || voiceName.includes("-")) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Voice Speed ({Math.round(voiceSpeed * 100)}%)
                    </label>
                    <Slider
                      value={[voiceSpeed]}
                      onValueChange={([value]) => setVoiceSpeed(value)}
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      disabled={isConnected}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  {/* Enhanced Avatar Switches */}
                  <EnhancedSwitch
                    checked={isAvatar}
                    onCheckedChange={setIsAvatar}
                    disabled={isConnected}
                    label="Avatar"
                  />
                  
                  {isAvatar && (
                    <EnhancedSwitch
                      checked={isCustomAvatar}
                      onCheckedChange={setIsCustomAvatar}
                      disabled={isConnected}
                      label="Use Custom Avatar"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  {isAvatar && !isCustomAvatar && (
                    <Select
                      value={avatarName}
                      onValueChange={setAvatarName}
                      disabled={isConnected}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {avatarNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isAvatar && isCustomAvatar && (
                    <Input
                      placeholder="Character"
                      value={customAvatarName}
                      onChange={(e) => setCustomAvatarName(e.target.value)}
                      disabled={isConnected}
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Connect Button and Download Recording Button */}
        <div className="mt-4 space-y-2">
          <Button
            className="w-full"
            variant={isConnected ? "destructive" : "default"}
            onClick={handleConnect}
            disabled={isConnecting}
          >
            <Power className="w-4 h-4 mr-2" />
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? "Disconnect"
                : "Connect"}
          </Button>

          {hasRecording && !isConnected && (
            <Button
              className="w-full"
              variant="outline"
              onClick={downloadRecording}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Recording
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Voice-Live-API-Chat</h1>
          
          {/* Settings */}
          {isMobile && (
            <div
              className="flex items-center settings"
              role="button"
              onClick={handleSettings}
            >
              <span className="settings-svg">{settingsSvg()}</span>
              <span>Settings</span>
            </div>
          )}

          {/* Enhanced Developer Mode Switch */}
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium">Developer mode</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
              isDevelop 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-400 text-white'
            }`}>
              {isDevelop ? 'ON' : 'OFF'}
            </span>
            <Switch
              checked={isDevelop}
              onCheckedChange={(checked: boolean) => setIsDevelop(checked)}
              className={`
                ${isDevelop 
                  ? 'data-[state=checked]:bg-green-600' 
                  : 'data-[state=unchecked]:bg-gray-400'
                }
              `}
            />
          </div>

          {/* Clear Chat */}
          <div>
            <button
              style={{ opacity: messages.length > 0 ? "" : "0.5" }}
              onClick={() => messages.length > 0 && setMessages([])}
            >
              {clearChatSvg()}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex ${isDevelop ? "developer-content" : "content"}`}>
          {isConnected &&
            (isEnableAvatar ? (
              <>
                {/* Video Window */}
                <div
                  ref={videoRef}
                  className={`flex flex-1 justify-center items-center`}
                ></div>
              </>
            ) : (
              <>
                {/* Animation Window */}
                <div className="flex flex-1 justify-center items-center">
                  <div
                    key="volume-circle"
                    ref={animationRef}
                    className="volume-circle"
                  ></div>
                  <div className="robot-svg">{robotSvg()}</div>
                </div>
              </>
            ))}

          {(isDevelop || !isConnected) && (
            <>
              {/* Chat Window */}
              <div className="flex flex-1 flex-col">
                {/* Messages Area */}
                <div
                  id="messages-area"
                  className="flex-1 p-4 overflow-y-auto messages-area"
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`mb-4 p-3 rounded-lg ${getMessageClassNames(message.type)}`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
                {isDevelop && (
                  <>
                    {/* Input Area */}
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input
                          value={currentMessage}
                          onChange={(e) => setCurrentMessage(e.target.value)}
                          placeholder="Type your message..."
                          onKeyUp={(e) => e.key === "Enter" && sendMessage()}
                          disabled={!isConnected}
                        />
                        <Button
                          variant="outline"
                          onClick={toggleRecording}
                          className={isRecording ? "bg-red-100" : ""}
                          disabled={!isConnected}
                        >
                          {isRecording ? recordingSvg() : offSvg()}
                        </Button>
                        <Button onClick={sendMessage} disabled={!isConnected}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isDevelop && (
          <>
            {/* Record Button */}
            <div className="flex flex-1 justify-center items-center">
              <div className="flex justify-center items-center recording-border">
                {isConnected && isEnableAvatar && isRecording && (
                  <div className="flex justify-center items-center sound-wave">
                    <div className="sound-wave-item" id="item-0"></div>
                    <div className="sound-wave-item" id="item-1"></div>
                    <div className="sound-wave-item" id="item-2"></div>
                    <div className="sound-wave-item" id="item-3"></div>
                    <div className="sound-wave-item" id="item-4"></div>
                    <div className="sound-wave-item" id="item-5"></div>
                    <div className="sound-wave-item" id="item-6"></div>
                    <div className="sound-wave-item" id="item-7"></div>
                    <div className="sound-wave-item" id="item-8"></div>
                    <div className="sound-wave-item" id="item-9"></div>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={toggleRecording}
                  className={isRecording ? "bg-red-100" : ""}
                  disabled={!isConnected}
                >
                  {isRecording ? (
                    <div className="flex justify-center items-center">
                      {recordingSvg()}
                      <span className="microphone">Turn off microphone</span>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center">
                      {offSvg()}
                      <span className="microphone">Turn on microphone</span>
                    </div>
                  )}
                </Button>
                {isConnected && isEnableAvatar && isRecording && (
                  <div className="flex justify-center items-center sound-wave sound-wave2">
                    <div className="sound-wave-item" id="item-10"></div>
                    <div className="sound-wave-item" id="item-11"></div>
                    <div className="sound-wave-item" id="item-12"></div>
                    <div className="sound-wave-item" id="item-13"></div>
                    <div className="sound-wave-item" id="item-14"></div>
                    <div className="sound-wave-item" id="item-15"></div>
                    <div className="sound-wave-item" id="item-16"></div>
                    <div className="sound-wave-item" id="item-17"></div>
                    <div className="sound-wave-item" id="item-18"></div>
                    <div className="sound-wave-item" id="item-19"></div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
