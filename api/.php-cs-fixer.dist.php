<?php

// The Symfony rule set, as in kofk's backend (D11); check-only in CI (composer cs).
$finder = (new PhpCsFixer\Finder())->in([__DIR__.'/src', __DIR__.'/tests', __DIR__.'/public', __DIR__.'/bin']);

return (new PhpCsFixer\Config())
    ->setRules([
        '@Symfony' => true,
        'yoda_style' => false,
        'concat_space' => ['spacing' => 'none'],
        'declare_strict_types' => true,
    ])
    ->setRiskyAllowed(true)
    ->setFinder($finder)
    ->setCacheFile(__DIR__.'/.php-cs-fixer.cache');
