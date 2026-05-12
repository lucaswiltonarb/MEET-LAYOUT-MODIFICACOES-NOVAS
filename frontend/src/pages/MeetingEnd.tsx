import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CallingState, useCallStateHooks } from '@stream-io/video-react-sdk';
import Button from '@/components/Button';
import PlainButton from '@/components/PlainButton';

const MeetingEnd = () => {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [countdownNumber, setCountdownNumber] = useState(60);
  const invalidMeeting = searchParams.get('invalid') === 'true';

  useEffect(() => {
    if (!invalidMeeting && callingState !== CallingState.LEFT) navigate('/');
    audioRef.current?.play();
    setCountdownNumber(59);
    const interval = setInterval(() => setCountdownNumber(prev => prev ? prev - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (countdownNumber === 0) navigate('/'); }, [countdownNumber, navigate]);

  if (!invalidMeeting && callingState !== CallingState.LEFT) return null;

  return (
    <div className="w-full">
      <div className="m-5 h-14 flex items-center justify-start gap-2">
        <div className="relative w-14 h-14 p-2 flex items-center justify-center text-center">
          <div className="text-meet-black font-normal text-sm font-roboto select-none">{countdownNumber}</div>
          <svg style={{ transform: 'rotateY(-180deg) rotateZ(-90deg)' }} className="absolute -top-[32px] -right-[12px] w-[100px] h-[100px]">
            <circle r="18" cx="40" cy="40" strokeDasharray={113} strokeDashoffset={0} strokeWidth={4} stroke="var(--primary)" fill="none" className="animate-countdown" />
          </svg>
        </div>
        <span className="font-roboto text-sm tracking-loosest">Voltando para a tela inicial</span>
      </div>
      <div className="mt-6 px-4 flex flex-col items-center gap-8">
        <h1 className="text-4xl leading-[2.75rem] font-normal text-dark-gray tracking-normal">{invalidMeeting ? 'Verifique o codigo da reuniao' : 'Voce saiu da reuniao'}</h1>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center justify-center gap-2">
            {!invalidMeeting && <PlainButton size="sm" className="border border-hairline-gray px-[23px]" onClick={() => navigate(`/${meetingId}`)}>Entrar novamente</PlainButton>}
            <Button size="sm" onClick={() => navigate('/')}>Voltar para a tela inicial</Button>
          </div>
        </div>
        <div className="max-w-100 flex flex-wrap flex-col rounded items-center pl-4 pr-3 pt-4 pb-1 border border-hairline-gray text-left">
          <div className="flex items-center">
            <img alt="Sua reuniao e segura" width={58} height={58} src="https://www.gstatic.com/meet/security_shield_356739b7c38934eec8fb0c8e93de8543.svg" />
            <div className="pl-4">
              <h2 className="text-meet-black text-lg leading-6 tracking-normal font-normal">Sua reuniao e segura</h2>
              <div className="font-roboto text-sm text-meet-gray tracking-loosest">Ninguem entra na reuniao sem ser convidado ou autorizado pelo organizador</div>
            </div>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src="https://www.gstatic.com/meet/sounds/leave_call_bfab46cf473a2e5d474c1b71ccf843a1.ogg" />
    </div>
  );
};

export default MeetingEnd;
