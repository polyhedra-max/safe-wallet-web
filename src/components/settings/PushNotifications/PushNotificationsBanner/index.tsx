import { Button, Chip, Grid, SvgIcon, Typography, IconButton } from '@mui/material'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect } from 'react'
import type { ReactElement } from 'react'

import { CustomTooltip } from '@/components/common/CustomTooltip'
import { AppRoutes } from '@/config/routes'
import { useAppSelector } from '@/store'
import { selectAddedSafes, selectAllAddedSafes, selectTotalAdded } from '@/store/addedSafesSlice'
import PushNotificationIcon from '@/public/images/notifications/push-notification.svg'
import useLocalStorage from '@/services/local-storage/useLocalStorage'
import { useNotificationRegistrations } from '../hooks/useNotificationRegistrations'
import { PUSH_NOTIFICATION_EVENTS } from '@/services/analytics/events/push-notifications'
import { trackEvent } from '@/services/analytics'
import useSafeInfo from '@/hooks/useSafeInfo'
import CheckWallet from '@/components/common/CheckWallet'
import CloseIcon from '@/public/images/common/close.svg'
import { useNotificationPreferences } from '../hooks/useNotificationPreferences'
import { sameAddress } from '@/utils/addresses'
import useOnboard from '@/hooks/wallets/useOnboard'
import { assertWalletChain } from '@/services/tx/tx-sender/sdk'
import { useCurrentChain, useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@/utils/chains'
import type { AddedSafesOnChain } from '@/store/addedSafesSlice'
import type { PushNotificationPreferences } from '@/services/push-notifications/preferences'
import type { NotifiableSafes } from '../logic'

import css from './styles.module.css'

const DISMISS_PUSH_NOTIFICATIONS_KEY = 'dismissPushNotifications'

export const useDismissPushNotificationsBanner = () => {
  const addedSafes = useAppSelector(selectAllAddedSafes)
  const { safe } = useSafeInfo()

  const [dismissedBannerPerChain = {}, setDismissedBannerPerChain] = useLocalStorage<{
    [chainId: string]: { [safeAddress: string]: boolean }
  }>(DISMISS_PUSH_NOTIFICATIONS_KEY)

  const dismissPushNotificationBanner = (chainId: string) => {
    const safesOnChain = Object.keys(addedSafes[chainId] || {})

    if (safesOnChain.length === 0) {
      return
    }

    const dismissedSafesOnChain = safesOnChain.reduce<{ [safeAddress: string]: boolean }>((acc, safeAddress) => {
      acc[safeAddress] = true
      return acc
    }, {})

    setDismissedBannerPerChain((prev) => ({
      ...prev,
      [safe.chainId]: dismissedSafesOnChain,
    }))
  }

  const isPushNotificationBannerDismissed = !!dismissedBannerPerChain[safe.chainId]?.[safe.address.value]

  return {
    dismissPushNotificationBanner,
    isPushNotificationBannerDismissed,
  }
}

export const _getSafesToRegister = (
  chainId: string,
  addedSafesOnChain: AddedSafesOnChain,
  allPreferences: PushNotificationPreferences | undefined,
): NotifiableSafes => {
  const addedSafeAddressesOnChain = Object.keys(addedSafesOnChain)

  if (!allPreferences) {
    return { [chainId]: addedSafeAddressesOnChain }
  }

  const notificationRegistrations = Object.values(allPreferences)

  const newlyAddedSafes = addedSafeAddressesOnChain.filter((safeAddress) => {
    return !notificationRegistrations.some(
      (registration) => chainId === registration.chainId && sameAddress(registration.safeAddress, safeAddress),
    )
  })

  return { [chainId]: newlyAddedSafes }
}

export const PushNotificationsBanner = ({ children }: { children: ReactElement }): ReactElement => {
  const isNotificationsEnabled = useHasFeature(FEATURES.PUSH_NOTIFICATIONS)
  const chain = useCurrentChain()
  const totalAddedSafes = useAppSelector(selectTotalAdded)
  const { safe, safeAddress } = useSafeInfo()
  const addedSafesOnChain = useAppSelector((state) => selectAddedSafes(state, safe.chainId))
  const { query } = useRouter()
  const onboard = useOnboard()

  const { dismissPushNotificationBanner, isPushNotificationBannerDismissed } = useDismissPushNotificationsBanner()

  const isSafeAdded = !!addedSafesOnChain?.[safeAddress]
  const shouldShowBanner = isNotificationsEnabled && !isPushNotificationBannerDismissed && isSafeAdded

  const { registerNotifications } = useNotificationRegistrations()
  const { getAllPreferences } = useNotificationPreferences()

  const dismissBanner = useCallback(() => {
    trackEvent(PUSH_NOTIFICATION_EVENTS.DISMISS_BANNER)
    dismissPushNotificationBanner(safe.chainId)
  }, [dismissPushNotificationBanner, safe.chainId])

  useEffect(() => {
    if (shouldShowBanner) {
      trackEvent(PUSH_NOTIFICATION_EVENTS.DISPLAY_BANNER)
    }
  }, [dismissBanner, shouldShowBanner])

  const onEnableAll = async () => {
    if (!onboard || !addedSafesOnChain) {
      return
    }

    trackEvent(PUSH_NOTIFICATION_EVENTS.ENABLE_ALL)

    const allPreferences = getAllPreferences()
    const safesToRegister = _getSafesToRegister(safe.chainId, addedSafesOnChain, allPreferences)

    try {
      await assertWalletChain(onboard, safe.chainId)
    } catch {
      return
    }

    await registerNotifications(safesToRegister)

    dismissBanner()
  }

  const onCustomize = () => {
    trackEvent(PUSH_NOTIFICATION_EVENTS.CUSTOMIZE_SETTINGS)

    dismissBanner()
  }

  if (!shouldShowBanner) {
    return children
  }

  return (
    <CustomTooltip
      className={css.banner}
      title={
        <Grid container className={css.container}>
          <Grid item xs={3}>
            <Chip label="New" className={css.chip} />
            <SvgIcon component={PushNotificationIcon} inheritViewBox fontSize="inherit" className={css.icon} />
          </Grid>
          <Grid item xs={9}>
            <Typography variant="subtitle2" fontWeight={700}>
              Enable push notifications
            </Typography>
            <IconButton onClick={dismissBanner} className={css.close}>
              <SvgIcon component={CloseIcon} inheritViewBox color="border" fontSize="small" />
            </IconButton>
            <Typography mt={0.5} mb={1.5} variant="body2">
              Get notified about pending signatures, incoming and outgoing transactions for all Safe Accounts on{' '}
              {chain?.chainName} when Safe
              {`{Wallet}`} is in the background or closed.
            </Typography>
            {/* Cannot wrap singular button as it causes style inconsistencies */}
            <CheckWallet>
              {(isOk) => (
                <div className={css.buttons}>
                  {totalAddedSafes > 0 && (
                    <Button
                      variant="contained"
                      size="small"
                      className={css.button}
                      onClick={onEnableAll}
                      disabled={!isOk || !onboard}
                    >
                      Enable all
                    </Button>
                  )}
                  {safe && (
                    <Link passHref href={{ pathname: AppRoutes.settings.notifications, query }} onClick={onCustomize}>
                      <Button variant="outlined" size="small" className={css.button}>
                        Customize
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CheckWallet>
          </Grid>
        </Grid>
      }
      open
    >
      <span>{children}</span>
    </CustomTooltip>
  )
}
