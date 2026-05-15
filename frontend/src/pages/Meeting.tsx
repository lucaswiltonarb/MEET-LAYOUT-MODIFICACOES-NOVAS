import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CallingState, hasScreenShare, isPinned, RecordCallButton, StreamTheme, useCall, useCallStateHooks, useConnectedUser } from '@stream-io/video-react-sdk';
import { Channel } from 'stream-chat';
import { DefaultStreamChatGenerics, useChatContext } from 'stream-chat-react';

import CallControlButton from '@/components/CallControlButton';
import CallInfoButton from '@/components/CallInfoButton';
import CallEndFilled from '@/components/icons/CallEndFilled';
import Chat from '@/components/icons/Chat';
import ChatFilled from '@/components/icons/ChatFilled';
import ChatNotifications from '@/components/ChatNotifications';
import ChatPopup from '@/components/ChatPopup';
import ClosedCaptions from '@/components/icons/ClosedCaptions';
import GridLayout from '@/components/GridLayout';
import Group from '@/components/icons/Group';
import Info from '@/components/icons/Info';
import Mood from '@/components/icons/Mood';
import PeoplePanel from '@/components/PeoplePanel';
import PresentToAll from '@/components/icons/PresentToAll';
import MeetingPopup from '@/components/MeetingPopup';
import MoreVert from '@/components/icons/MoreVert';
import RecordingsPopup from '@/components/RecordingsPopup';
import SpeakerLayout from '@/components/SpeakerLayout';
import ToggleAudioButton from '@/components/ToggleAudioButton';
import ToggleVideoButton from '@/components/ToggleVideoButton';
import useTime from '@/hooks/useTime';

const Meeting = () => {
  const { meetingId } = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();
  const call = useCall();
  const user = useConnectedUser();
  const { currentTime } = useTime();
  const { client: chatClient } = useChatContext();
  const { useCallCallingState, useParticipants, useScreenShareState } = useCallStateHooks();
  const participants = useParticipants();
  const { screenShare } = useScreenShareState();
  const callingState = useCallCallingState();
  const [chatChannel, setChatChannel] = useState<Channel<DefaultStreamChatGenerics>>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isRecordingListOpen, setIsRecordingListOpen] = useState(false);
  const [participantInSpotlight] = participants;
  const [prevParticipantsCount, setPrevParticipantsCount] = useState(0);
  const isCreator = call?.state.createdBy?.id === user?.id;
  const isUnkownOrIdle = callingState === CallingState.UNKNOWN || callingState === CallingState.IDLE;

  useEffect(() => {
    const startup = async () => {
      if (isUnkownOrIdle) { navigate(`/${meetingId}`); return; }
      if (chatClient && chatClient.userID) {
        try { await fetch('/api/channel-join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, userId: chatClient.userID, userName: user?.name || chatClient.userID }) }); } catch {}
        const channel = chatClient.channel('messaging', meetingId);
        try { await channel.watch(); } catch {}
        setChatChannel(channel);
      }
    };
    startup();
  }, [navigate, meetingId, isUnkownOrIdle, chatClient, user?.name]);

  useEffect(() => {
    if (participants.length > prevParticipantsCount) { audioRef.current?.play(); setPrevParticipantsCount(participants.length); }
  }, [participants.length, prevParticipantsCount]);

  const isSpeakerLayout = useMemo(() => participantInSpotlight ? hasScreenShare(participantInSpotlight) || isPinned(participantInSpotlight) : false, [participantInSpotlight]);
  const leaveCall = async () => { await call?.leave(); navigate(`/${meetingId}/meeting-end`); };
  const toggleScreenShare = async () => { try { await screenShare.toggle(); } catch {} };

  if (isUnkownOrIdle) return null;

  return (
    <StreamTheme className="root-theme">
      <div className="relative w-svw h-svh bg-meet-black overflow-hidden flex">
        <div className="relative flex-1 min-w-0 transition-[flex-basis] duration-200">
          {isSpeakerLayout ? <SpeakerLayout /> : <GridLayout />}
          <div className="absolute left-0 bottom-0 right-0 w-full h-20 bg-meet-black text-white text-center flex items-center justify-between">
            <div className="hidden sm:flex grow shrink basis-1/4 items-center text-start justify-start ml-3 truncate max-w-full">
              <div className="flex items-center overflow-hidden mx-3 h-20 gap-3 select-none">
                <span className="font-medium">{currentTime}</span><span>|</span><span className="font-medium truncate">{meetingId}</span>
              </div>
            </div>
            <div className="relative flex grow shrink basis-1/4 items-center justify-center px-1.5 gap-3 ml-0">
              <ToggleAudioButton /><ToggleVideoButton />
              <CallControlButton icon={<ClosedCaptions />} title="Ativar legendas" />
              <CallControlButton icon={<Mood />} title="Enviar uma reacao" className="hidden sm:inline-flex" />
              <CallControlButton onClick={toggleScreenShare} icon={<PresentToAll />} title="Apresentar agora" />
              <RecordCallButton />
              <div className="hidden sm:block relative">
                <CallControlButton onClick={() => setIsRecordingListOpen(p => !p)} icon={<MoreVert />} title="Ver lista de gravacoes" />
                <RecordingsPopup isOpen={isRecordingListOpen} onClose={() => setIsRecordingListOpen(false)} />
              </div>
              <CallControlButton onClick={leaveCall} icon={<CallEndFilled />} title="Sair da chamada" className="leave-call-button" />
            </div>
            <div className="hidden sm:flex grow shrink basis-1/4 items-center justify-end mr-3">
              <CallInfoButton icon={<Info />} title="Detalhes da reuniao" />
              <CallInfoButton onClick={() => { setIsPeopleOpen(p => !p); setIsChatOpen(false); }} icon={<Group />} title="Pessoas" />
              <CallInfoButton onClick={() => { setIsChatOpen(p => !p); setIsPeopleOpen(false); }} icon={isChatOpen ? <ChatFilled color="var(--icon-blue)" /> : <Chat />} title="Conversar com todos" />
            </div>
          </div>
        </div>
        {(isChatOpen || isPeopleOpen) && (
          <div className="relative shrink-0 h-svh transition-all duration-200" style={{ width: 360, padding: '8px 8px 8px 0' }}>
            {isPeopleOpen && <PeoplePanel isOpen={isPeopleOpen} onClose={() => setIsPeopleOpen(false)} meetingId={meetingId!} />}
            {isChatOpen && <ChatPopup channel={chatChannel!} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
          </div>
        )}
        <ChatNotifications channel={chatChannel} isChatOpen={isChatOpen} currentUserId={chatClient?.userID || user?.id} onClickToast={() => { setIsChatOpen(true); setIsPeopleOpen(false); }} />
        {isCreator && <MeetingPopup />}
        <audio ref={audioRef} src="https://www.gstatic.com/meet/sounds/join_call_6a6a67d6bcc7a4e373ed40fdeff3930a.ogg" />
      </div>
    </StreamTheme>
  );
};

export default Meeting;
