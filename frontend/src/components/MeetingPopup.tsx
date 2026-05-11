import Image from 'next/image';
import { useEffect } from 'react';
import { useCall, useConnectedUser } from '@stream-io/video-react-sdk';

import ButtonWithIcon from './ButtonWithIcon';
import Clipboard from './Clipboard';
import PersonAdd from './icons/PersonAdd';
import Popup from './Popup';
import useLocalStorage from '../hooks/useLocalStorage';

const MeetingPopup = () => {
  const user = useConnectedUser();
  const call = useCall();
  const meetingId = call?.id!;

  const [seen, setSeen] = useLocalStorage(`meetingPopupSeen`, {
    [meetingId]: false,
  });

  const email = user?.custom?.email || user?.name || user?.id;
  const clipboardValue = window.location.href
    .replace('http://', '')
    .replace('https://', '')
    .replace('/meeting', '');

  const onClose = () => {
    setSeen({
      ...seen,
      [meetingId]: true,
    });
  };

  useEffect(() => {
    setSeen({
      ...seen,
      [meetingId]: seen[meetingId] || false,
    });

    const setSeenTrue = () => {
      if (seen[meetingId]) return;
      setSeen({
        ...seen,
        [meetingId]: true,
      });
    };

    return () => {
      setSeenTrue();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Popup
      open={!seen[meetingId]}
      onClose={onClose}
      title={<h2>Sua reunião está pronta</h2>}
      className="bottom-0 -translate-y-22.5 animate-popup"
    >
      <div className="p-6 pt-0">
        <ButtonWithIcon
          icon={
            <div className="w-6.5 flex items-center justify-start">
              <PersonAdd />
            </div>
          }
          rounding="lg"
          size="sm"
          variant="secondary"
        >
          Adicionar pessoas
        </ButtonWithIcon>
        <div className="mt-2 text-dark-gray text-sm font-roboto tracking-looserst">
          Ou compartilhe este link com quem você quer na reunião
        </div>
        <div className="mt-2">
          <Clipboard value={clipboardValue} />
        </div>
        <div className="my-4 flex items-center gap-2">
          <Image
            width={26}
            height={26}
            alt="Sua reunião é segura"
            src="https://www.gstatic.com/meet/security_shield_with_background_2f8144e462c57b3e56354926e0cda615.svg"
          />
          <div className="text-xs font-roboto text-meet-gray tracking-wide">
            As pessoas que usarem este link precisarão da sua autorização para entrar.
          </div>
        </div>
        <div className="text-xs font-roboto text-meet-gray tracking-wide">
          Conectado como {email}
        </div>
      </div>
    </Popup>
  );
};

export default MeetingPopup;
