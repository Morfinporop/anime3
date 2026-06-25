import { useState, useEffect } from 'react';

interface CookieSettings {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<CookieSettings>({
    necessary: true,
    analytics: true,
    functional: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem('cookie_consent');
    if (!stored) setVisible(true);
  }, []);

  const acceptAll = () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ necessary: true, analytics: true, functional: true }));
    setVisible(false);
  };

  const acceptCustom = () => {
    localStorage.setItem('cookie_consent', JSON.stringify(settings));
    setVisible(false);
    setShowSettings(false);
  };

  const declineAll = () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ necessary: true, analytics: false, functional: false }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100%-2rem)] sm:w-80">
      <div className="rounded-2xl bg-white shadow-2xl border border-zinc-200 p-5">
        {!showSettings ? (
          <>
            <h3 className="text-sm font-bold text-zinc-900 mb-1">Правила Cookie</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Принимая правила Cookie, вы даёте согласие на использование файлов cookie для улучшения работы сайта.
            </p>
            <div className="flex gap-2">
              <button onClick={acceptAll} className="flex-1 rounded-full bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800">Принимаю</button>
              <button onClick={() => setShowSettings(true)} className="flex-1 rounded-full border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">Настроить</button>
              <button onClick={declineAll} className="flex-1 rounded-full border border-zinc-200 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-50">Отказываю</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-bold text-zinc-900 mb-3">Настройки Cookie</h3>
            <div className="space-y-2 mb-4">
              <label className="flex items-center justify-between text-xs text-zinc-700">
                <span>Обязательные</span>
                <input type="checkbox" checked={settings.necessary} disabled className="accent-zinc-900 opacity-50" />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-700">
                <span>Аналитика</span>
                <input type="checkbox" checked={settings.analytics} onChange={(e) => setSettings({ ...settings, analytics: e.target.checked })}
                  className="accent-zinc-900" />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-700">
                <span>Функциональные</span>
                <input type="checkbox" checked={settings.functional} onChange={(e) => setSettings({ ...settings, functional: e.target.checked })}
                  className="accent-zinc-900" />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={acceptCustom} className="flex-1 rounded-full bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800">Сохранить</button>
              <button onClick={() => setShowSettings(false)} className="flex-1 rounded-full border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">Назад</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
