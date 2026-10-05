import {useLanguage} from '../i18n';
import {useUIMotion} from '../state/uiMotion';
export default function UIMotionControl(){
 const {t}=useLanguage(),{mode,cycle}=useUIMotion();
 const label=mode==='full'?t('动效 · 开','Motion · On'):mode==='reduced'?t('动效 · 关','Motion · Off'):t('动效 · 自动','Motion · Auto');
 return <button type="button" className="heritage-motion" onClick={cycle} title={t('界面动效：自动遵循系统设置；点击切换开、关、自动','UI motion: Auto follows your system; cycle On, Off, Auto')}>{label}</button>;
}
