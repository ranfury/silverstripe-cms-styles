<?php

namespace Ranfury\CMSStyles\Extensions;

use SilverStripe\Core\Extension;
use SilverStripe\ORM\FieldType\DBField;
use SilverStripe\ORM\FieldType\DBHTMLText;
use SilverStripe\Core\Manifest\ModuleResourceLoader;

/**
 * The script for pages shown in the CMS preview (scripts/preview.js: the SEO heading check).
 * Add {$CMSStylesPreviewScripts} to the page template's <head>, it only runs inside the CMS
 */
class ContentControllerExtension extends Extension
{
    public function getCMSStylesPreviewScripts(): DBHTMLText
    {
        $src = ModuleResourceLoader::resourceURL('ranfury/silverstripe-cms-styles: client/dist/scripts/preview.js');

        // Only fetched when the page is in an iframe (the preview)
        $script = '<script type="module">if (window.self !== window.top) import("' . $src . '");</script>';

        return DBField::create_field('HTMLFragment', $script);
    }
}
