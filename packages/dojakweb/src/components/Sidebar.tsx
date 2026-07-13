import React from 'react';
import {
  CogIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  WalletIcon,
  CircleStackIcon,
  TagIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  PhotoIcon,
  LockClosedIcon,
  ChartBarIcon,
  InboxStackIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  SparklesIcon,
  HomeIcon,
  WrenchScrewdriverIcon,
  RssIcon,
} from '@heroicons/react/24/outline';
import { useFeatureStore, type FeatureId } from '../stores/featureStore';

interface SidebarProps {
  isOpen: boolean;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClose: () => void;
}

const navigationItems = [
  { id: 'demo',         label: 'Home',        icon: HomeIcon },
  { id: 'wallet',       label: 'Wallet',      icon: WalletIcon },
  /** Collapsible only — does not navigate; sub-items handle routes. */
  { id: 'inscriptions', label: 'Inscribe',    icon: PhotoIcon },
  { id: 'dogetokens',   label: 'ÐogeTokens',  icon: CurrencyDollarIcon },
  { id: 'marketplace',  label: 'Marketplace', icon: ShoppingBagIcon },
  { id: 'time-locks',   label: 'Time Locks',  icon: LockClosedIcon },
  { id: 'tools',        label: 'Tools',       icon: WrenchScrewdriverIcon },
  { id: 'nostr',        label: 'Nostr',       icon: RssIcon },
  { id: 'address-book', label: 'Address Book',icon: UserGroupIcon },
  { id: 'settings',     label: 'Settings',    icon: CogIcon },
  { id: 'support',      label: 'Support',     icon: QuestionMarkCircleIcon },
] as const;

const inscriptionsItems = [
  { id: 'inscribe',  label: 'Inscribe file', icon: PhotoIcon },
  { id: 'dogetags',  label: 'Create DogeTag', icon: TagIcon },
] as const;

const dogeTokensItems = [
  { id: 'treats', label: 'ÐogeTreats', icon: CurrencyDollarIcon },
  { id: 'drc20',  label: 'Legacy ÐRC-20', icon: CurrencyDollarIcon },
  { id: 'dunes',  label: 'Ðunes',  icon: CircleStackIcon },
  { id: 'charms', label: 'Charms', icon: SparklesIcon },
] as const;

const marketplaceItems = [
  { id: 'dmp',      label: 'ÐMP',             icon: ShoppingBagIcon },
  { id: 'tool-buy', label: 'Buy inscription', icon: ShoppingCartIcon },
] as const;

const timeLockItems = [
  { id: 'dogenal-locker', label: 'Ðogenal Locker', icon: LockClosedIcon },
  { id: 'soft-staking',   label: 'Soft Staking',   icon: ChartBarIcon },
  { id: 'locked-assets',  label: 'Locked Assets',  icon: InboxStackIcon },
] as const;

const INSCRIPTIONS_IDS = new Set<string>(inscriptionsItems.map((i) => i.id));
const DOGE_TOKENS_IDS  = new Set<string>(dogeTokensItems.map((i) => i.id));
const MARKETPLACE_IDS  = new Set<string>(marketplaceItems.map((i) => i.id));
const TIME_LOCK_IDS    = new Set<string>(timeLockItems.map((i) => i.id));

function SidebarItem({
  item,
  isHovered,
  isActive,
  onClick,
}: {
  item: { label: string; icon: React.ElementType };
  isHovered: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-md transition-all duration-200 group ${
        isActive
          ? 'bg-primary-900/50 text-primary-400 border-l-2 border-primary-400'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className={`transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
        {item.label}
      </span>
    </button>
  );
}

function SidebarGroup({
  titleItem,
  childItems,
  activeSection,
  isHovered,
  isOpen,
  onToggle,
  onSelectChild,
}: {
  titleItem: { id: string; label: string; icon: React.ElementType };
  childItems: ReadonlyArray<{ id: string; label: string; icon: React.ElementType }>;
  activeSection: string;
  isHovered: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelectChild: (id: string) => void;
}) {
  const Icon = titleItem.icon;
  const isActive = childItems.some((child) => child.id === activeSection);

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={`w-full flex items-center justify-between space-x-3 px-3 py-3 rounded-md transition-all duration-200 group ${
          isActive
            ? 'bg-primary-900/50 text-primary-400 border-l-2 border-primary-400'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
        }`}
      >
        <span className="flex items-center space-x-3">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className={`transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
            {titleItem.label}
          </span>
        </span>
        <span className={`text-xs transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <ul className="mt-1 space-y-1 pl-4">
          {childItems.map((child) => {
            const ChildIcon = child.icon;
            const isChildActive = activeSection === child.id;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onSelectChild(child.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-all duration-200 ${
                    isChildActive
                      ? 'bg-primary-900/50 text-primary-400 border-l-2 border-primary-400'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  <ChildIcon className="w-4 h-4 flex-shrink-0" />
                  <span className={`text-sm transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                    {child.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeSection,
  onSectionChange,
  onClose,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const [isInscriptionsOpen, setIsInscriptionsOpen] = React.useState(INSCRIPTIONS_IDS.has(activeSection));
  const [isDogeTokensOpen,   setIsDogeTokensOpen]   = React.useState(DOGE_TOKENS_IDS.has(activeSection));
  const [isMarketplaceOpen,  setIsMarketplaceOpen]  = React.useState(MARKETPLACE_IDS.has(activeSection));
  const [isTimeLocksOpen,    setIsTimeLocksOpen]    = React.useState(TIME_LOCK_IDS.has(activeSection));

  React.useEffect(() => {
    if (INSCRIPTIONS_IDS.has(activeSection)) setIsInscriptionsOpen(true);
    if (DOGE_TOKENS_IDS.has(activeSection))  setIsDogeTokensOpen(true);
    if (MARKETPLACE_IDS.has(activeSection))  setIsMarketplaceOpen(true);
    if (TIME_LOCK_IDS.has(activeSection))    setIsTimeLocksOpen(true);
  }, [activeSection]);

  const renderItems = (hovered: boolean, closeFn?: () => void) => {
    const { isFeatureVisible } = useFeatureStore.getState();

    const visibleNavigationItems = navigationItems.filter((item) => {
      switch (item.id) {
        case 'inscriptions': return inscriptionsItems.some((c) => isFeatureVisible(c.id as FeatureId));
        case 'dogetokens':   return dogeTokensItems.some((c) => isFeatureVisible(c.id as FeatureId));
        case 'marketplace':  return marketplaceItems.some((c) => isFeatureVisible(c.id as FeatureId));
        case 'time-locks':   return timeLockItems.some((c) => isFeatureVisible(c.id as FeatureId));
        default:             return isFeatureVisible(item.id as FeatureId);
      }
    });

    const visibleInscriptionsItems = inscriptionsItems.filter((i) => isFeatureVisible(i.id as FeatureId));
    const visibleDogeTokensItems   = dogeTokensItems.filter((i) => isFeatureVisible(i.id as FeatureId));
    const visibleMarketplaceItems  = marketplaceItems.filter((i) => isFeatureVisible(i.id as FeatureId));
    const visibleTimeLockItems     = timeLockItems.filter((i) => isFeatureVisible(i.id as FeatureId));

    const nav = (id: string, closeFn?: () => void) => () => { onSectionChange(id); closeFn?.(); };

    return (
      <ul className="space-y-1 px-3">
        {visibleNavigationItems.map((item) => {
          if (item.id === 'inscriptions' && visibleInscriptionsItems.length > 0) {
            return (
              <li key={item.id}>
                <SidebarGroup
                  titleItem={item}
                  childItems={visibleInscriptionsItems as any}
                  activeSection={activeSection}
                  isHovered={hovered}
                  isOpen={isInscriptionsOpen}
                  onToggle={() => setIsInscriptionsOpen((p) => !p)}
                  onSelectChild={(id) => { onSectionChange(id); closeFn?.(); }}
                />
              </li>
            );
          }

          if (item.id === 'dogetokens' && visibleDogeTokensItems.length > 0) {
            return (
              <li key={item.id}>
                <SidebarGroup
                  titleItem={item}
                  childItems={visibleDogeTokensItems as any}
                  activeSection={activeSection}
                  isHovered={hovered}
                  isOpen={isDogeTokensOpen}
                  onToggle={() => setIsDogeTokensOpen((p) => !p)}
                  onSelectChild={(id) => { onSectionChange(id); closeFn?.(); }}
                />
              </li>
            );
          }

          if (item.id === 'marketplace' && visibleMarketplaceItems.length > 0) {
            return (
              <li key={item.id}>
                <SidebarGroup
                  titleItem={item}
                  childItems={visibleMarketplaceItems as any}
                  activeSection={activeSection}
                  isHovered={hovered}
                  isOpen={isMarketplaceOpen}
                  onToggle={() => setIsMarketplaceOpen((p) => !p)}
                  onSelectChild={(id) => { onSectionChange(id); closeFn?.(); }}
                />
              </li>
            );
          }

          if (item.id === 'time-locks' && visibleTimeLockItems.length > 0) {
            return (
              <li key={item.id}>
                <SidebarGroup
                  titleItem={item}
                  childItems={visibleTimeLockItems as any}
                  activeSection={activeSection}
                  isHovered={hovered}
                  isOpen={isTimeLocksOpen}
                  onToggle={() => setIsTimeLocksOpen((p) => !p)}
                  onSelectChild={(id) => { onSectionChange(id); closeFn?.(); }}
                />
              </li>
            );
          }

          // Tools: single flat item → lands on WalletLabPage overview
          if (item.id === 'tools') {
            return (
              <li key={item.id}>
                <SidebarItem
                  item={item}
                  isHovered={hovered}
                  isActive={activeSection.startsWith('tool-')}
                  onClick={nav('tool-overview', closeFn)}
                />
              </li>
            );
          }

          return (
            <li key={item.id}>
              <SidebarItem
                item={item}
                isHovered={hovered}
                isActive={activeSection === item.id}
                onClick={nav(item.id, closeFn)}
              />
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed left-0 top-16 bottom-10 z-10 bg-bg-primary border-r border-border-primary transition-all duration-200 ease-out ${
          isHovered ? 'sidebar-expanded' : 'sidebar-collapsed'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <nav className="w-full py-4">{renderItems(isHovered)}</nav>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-bg-primary border-r border-border-primary">
            <div className="flex items-center justify-between p-4 border-b border-border-primary">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">D</span>
                </div>
                <span className="text-xl font-bold text-text-primary">Dojak</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="p-2 rounded-md hover:bg-bg-secondary transition-colors duration-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-4 overflow-y-auto h-[calc(100%-65px)]">
              {renderItems(true, onClose)}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
};
