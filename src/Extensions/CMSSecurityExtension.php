<?php

namespace Ranfury\CMSStyles\Extensions;

use InvalidArgumentException;
use SilverStripe\Core\Extension;
use SilverStripe\View\Requirements;

/**
 * The log back in page: what the "session timed out" dialog shows in its iframe (CMSSecurity/login). It's a page of
 * its own, not a LeftAndMain screen, so LeftAndMainExtension never runs for it and it loads the admin's own
 * bundle.css. This blocks that and puts login.css in its <head> in its place, with a small script that applies the
 * theme colour and light / dark mode picked in the CMS. The page is the same origin as the CMS, so it reads the
 * browser's saved settings (appearance-settings.js)
 *
 * Both are inlined: the page is small, and it's drawn in the right colours the first time
 */
class CMSSecurityExtension extends Extension
{
    private const ADMIN_STYLES = 'silverstripe/admin: client/dist/styles/bundle.css';

    protected function onAfterInit(): void
    {
        // Like any module, "silverstripe/admin" in ignored_modules keeps the admin's own styles
        if (in_array('silverstripe/admin', (array) LeftAndMainExtension::config()->get('ignored_modules'), true)) {
            return;
        }

        $styles = LeftAndMainExtension::getDistFile('client/dist/styles/login.css');

        // Nothing to put in its place (not built): keep the admin's styles rather than leave the page with none
        if (!$styles) {
            return;
        }

        try {
            Requirements::block(self::ADMIN_STYLES);
        } catch (InvalidArgumentException) {
            // The stylesheet isn't there, so there is nothing to block
        }

        Requirements::insertHeadTags(
            LeftAndMainExtension::getConfigTag(['hue' => LeftAndMainExtension::getThemeHue()]),
            'CMSStylesConfig'
        );

        if ($boot = LeftAndMainExtension::getDistFile('client/dist/scripts/login-boot.js')) {
            Requirements::insertHeadTags('<script>' . $boot . '</script>', 'CMSStylesAppearance');
        }

        Requirements::insertHeadTags('<style>' . $styles . '</style>', 'CMSStylesLogin');
    }
}
