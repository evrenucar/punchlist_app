    function syncSettingsControls() {
      const settings = state.settings;
      if (pasteModeEl) pasteModeEl.value = ["alias", "reference", "duplicate", "ask"].includes(settings.pasteMode) ? settings.pasteMode : "alias";
      if (imageResolutionEl) imageResolutionEl.value = ["original", "high", "medium", "low"].includes(settings.imageResolution) ? settings.imageResolution : "medium";
      if (markdownModeEl) markdownModeEl.value = MARKDOWN_MODES.includes(settings.markdownMode) ? settings.markdownMode : "edit";
      if (markdownShortcutsEl) markdownShortcutsEl.checked = settings.markdownShortcuts !== false;
      if (markdownWholeWordsEl) markdownWholeWordsEl.checked = settings.markdownWholeWords !== false;
      const retention = settings.completionRetentionSeconds;
      const completionMode = retention === null ? "never" : Number(retention) === 0 ? "immediate" : "custom";
      if (completionModeEl) completionModeEl.value = completionMode;
      const completionParts = secondsToDurationParts(Number(retention) > 0 ? retention : DEFAULT_SETTINGS.completionRetentionSeconds);
      if (completionValueEl) completionValueEl.value = String(completionParts.value);
      if (completionUnitEl) completionUnitEl.value = completionParts.unit;
      if (completionDurationEl) completionDurationEl.hidden = completionMode !== "custom";
      const deleteMode = settings.deleteMode === "permanent" ? "permanent" : "trash";
      if (deleteModeEl) deleteModeEl.value = deleteMode;
      const trashRetention = settings.trashRetentionSeconds;
      const trashMode = trashRetention === null ? "forever" : "custom";
      if (trashModeEl) trashModeEl.value = trashMode;
      const trashParts = secondsToDurationParts(Number(trashRetention) > 0 ? trashRetention : DEFAULT_SETTINGS.completionRetentionSeconds);
      if (trashValueEl) trashValueEl.value = String(trashParts.value);
      if (trashUnitEl) trashUnitEl.value = trashParts.unit;
      if (trashModeRowEl) trashModeRowEl.hidden = deleteMode === "permanent";
      if (trashDurationEl) trashDurationEl.hidden = deleteMode === "permanent" || trashMode !== "custom";
      if (exportCompletedEl) exportCompletedEl.checked = settings.exportCompleted !== false;
      if (exportTrashEl) exportTrashEl.checked = Boolean(settings.exportTrash);
      if (policyOverridesEl) policyOverridesEl.checked = Boolean(settings.policyOverrides);
      if (sinkCompletedEl) sinkCompletedEl.checked = Boolean(settings.sinkCompleted);
      if (featureMetadataEl) featureMetadataEl.checked = Boolean(settings.metadata);
      if (featureTimelineEl) featureTimelineEl.checked = Boolean(settings.timelineView);
      if (featureRemindersEl) featureRemindersEl.checked = Boolean(settings.reminders);
      if (featureNotificationsEl) featureNotificationsEl.checked = Boolean(settings.browserNotifications);
      if (usernameEl) usernameEl.value = String(settings.username || "");
      if (deviceNameEl) deviceNameEl.value = String(deviceIdentity.name || "");
      if (identityLineEl) {
        identityLineEl.hidden = !state.identity;
        if (state.identity) identityLineEl.textContent = `Signing identity: ${String(settings.username || "").trim() || "unnamed"} · ${state.identity.fingerprint}`;
      }
      if (syncDevicesEl) syncDevicesEl.innerHTML = renderDeviceRoster();
      renderSharedOriginWarning();
      // POSITIVE rule, deliberately (design P4): hidden only for a condition
      // that is TRUE in demo. Phrased the other way round — "hide unless the
      // host is the new domain" — every file:// copy would lose sync, because
      // there the host is the empty string and never matches. The Updates
      // section below gets this right the same way, by testing IS_LOCAL_FILE
      // explicitly rather than by excluding hosts.
      if (syncSectionEl) syncSectionEl.hidden = IS_DEMO;
      if (reportBugEl) reportBugEl.hidden = IS_DEMO;
      if (syncEnabledEl) syncEnabledEl.checked = Boolean(syncConfig.enabled);
      if (syncFieldsEl) syncFieldsEl.hidden = !syncConfig.enabled;
      // Never fail silently: turning sync on with no device name used to do
      // nothing at all, with nothing on screen saying why.
      const gap = syncSetupGap();
      if (deviceNameEl) deviceNameEl.classList.toggle("needed", Boolean(syncConfig.enabled) && !deviceIdentity.name.trim());
      if (syncStatusEl && gap) syncStatusEl.textContent = gap;
      if (syncRepoEl) syncRepoEl.value = String(syncConfig.repo || "");
      if (syncTokenEl) syncTokenEl.value = String(syncConfig.token || "");
      if (checkUpdatesEl) checkUpdatesEl.checked = settings.checkForUpdates !== false;
      if (updateVersionEl) updateVersionEl.textContent = `This copy is v${APP_VERSION}.`;
      // Only a downloaded (file://) copy can go stale, so only it gets the
      // Updates box. On the hosted app there is nothing to check or turn off, so
      // showing an inert toggle there is dead UI — hide the whole section.
      if (updatesSectionEl) updatesSectionEl.hidden = IS_DEMO || !IS_LOCAL_FILE;
    }

    function updateSettings(patch) {
      Object.assign(state.settings, patch);
      saveState();
      syncSettingsControls();
      render();
    }

    function readCompletionRetentionFromControls() {
      const mode = completionModeEl?.value || "custom";
      if (mode === "never") return null;
      if (mode === "immediate") return 0;
      const seconds = durationToSeconds(completionValueEl?.value, completionUnitEl?.value || "days");
      if (seconds > 0) return seconds;
      const current = state.settings.completionRetentionSeconds;
      return Number(current) > 0 ? current : DEFAULT_SETTINGS.completionRetentionSeconds;
    }

    function readTrashRetentionFromControls() {
      if ((trashModeEl?.value || "forever") === "forever") return null;
      const seconds = durationToSeconds(trashValueEl?.value, trashUnitEl?.value || "days");
      if (seconds > 0) return seconds;
      const current = state.settings.trashRetentionSeconds;
      return Number(current) > 0 ? current : DEFAULT_SETTINGS.completionRetentionSeconds;
    }

    pasteModeEl?.addEventListener("change", () => updateSettings({ pasteMode: pasteModeEl.value }));
    markdownModeEl?.addEventListener("change", () => updateSettings({ markdownMode: markdownModeEl.value }));
    markdownShortcutsEl?.addEventListener("change", () => updateSettings({ markdownShortcuts: markdownShortcutsEl.checked }));
    markdownWholeWordsEl?.addEventListener("change", () => updateSettings({ markdownWholeWords: markdownWholeWordsEl.checked }));
    // Changing the tier only affects pastes from now on; compressImageFile is
    // the sole caller and it runs at paste time. Nothing revisits stored images.
    function describeImageResolutionChange(previous, next) {
      const rank = (tier) => ["low", "medium", "high", "original"].indexOf(tier);
      return rank(next) > rank(previous)
        ? "Images pasted from now on keep more detail. Existing images are unchanged."
        : "New pastes will be smaller. Existing images are not downscaled.";
    }

    imageResolutionEl?.addEventListener("change", () => {
      const previous = state.settings.imageResolution;
      const next = imageResolutionEl.value;
      updateSettings({ imageResolution: next });
      if (next !== previous) showToast(describeImageResolutionChange(previous, next));
    });
    [completionModeEl, completionValueEl, completionUnitEl].forEach((element) => {
      element?.addEventListener("change", () => updateSettings({ completionRetentionSeconds: readCompletionRetentionFromControls() }));
    });
    deleteModeEl?.addEventListener("change", () => updateSettings({ deleteMode: deleteModeEl.value === "permanent" ? "permanent" : "trash" }));
    [trashModeEl, trashValueEl, trashUnitEl].forEach((element) => {
      element?.addEventListener("change", () => updateSettings({ trashRetentionSeconds: readTrashRetentionFromControls() }));
    });
    exportCompletedEl?.addEventListener("change", () => updateSettings({ exportCompleted: exportCompletedEl.checked }));
    exportTrashEl?.addEventListener("change", () => updateSettings({ exportTrash: exportTrashEl.checked }));
    policyOverridesEl?.addEventListener("change", () => updateSettings({ policyOverrides: policyOverridesEl.checked }));
    sinkCompletedEl?.addEventListener("change", () => updateSettings({ sinkCompleted: sinkCompletedEl.checked }));
    usernameEl?.addEventListener("change", () => updateSettings({ username: usernameEl.value.trim() }));
    deviceNameEl?.addEventListener("change", () => {
      const wasActive = syncIsActive();
      saveDeviceIdentity({ name: deviceNameEl.value.trim() });
      saveState();
      syncSettingsControls();
      // Naming the device is the last missing piece often enough that waiting
      // for a reload to start syncing would read as the toggle being broken.
      if (!wasActive && syncIsActive()) syncNow("config");
    });
    exportSettingsEl?.addEventListener("click", downloadSettingsExport);

    syncEnabledEl?.addEventListener("change", () => {
      saveSyncConfig({ enabled: syncEnabledEl.checked });
      syncSettingsControls();
      if (syncIsActive()) syncNow("enable");
    });
    syncRepoEl?.addEventListener("change", () => {
      // Accept a pasted repo URL; store it as owner/name. A new repo means the
      // remembered sha no longer describes anything.
      const repo = syncRepoEl.value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/+$/, "");
      saveSyncConfig({ repo, lastSha: null });
      syncSettingsControls();
      if (syncIsActive()) syncNow("config");
    });
    syncTokenEl?.addEventListener("change", () => {
      saveSyncConfig({ token: syncTokenEl.value.trim() });
      // A token landing here is exactly what raises the warning from amber to
      // red, so the notice re-renders on the same edit that stores it.
      renderSharedOriginWarning();
      if (syncIsActive()) syncNow("config");
    });
    syncNowEl?.addEventListener("click", () => syncNow("manual"));

    syncDevicesEl?.addEventListener("click", (event) => {
      const id = event.target.closest("[data-forget-device]")?.dataset.forgetDevice;
      if (!id) return;
      const name = deviceDisplayName(id);
      if (forgetDevice(id)) showToast(`Forgot ${name}. Ctrl+Z brings it back.`);
    });

    checkUpdatesEl?.addEventListener("change", () => updateSettings({ checkForUpdates: checkUpdatesEl.checked }));

    // Evren, 2026-07-28: ": and then type emoji creation and insertion", and
    // when asked how big the list should be, given it ships inside the one
    // file: "A few hundred common ones is plenty." The full Unicode set with
    // searchable names is ~200 KB, about half the app. This is ~250, weighted
    // towards what a task board actually needs: status, work, time, feeling.
    // One line each, glyph then the words it answers to. Order is the tie
    // break, so the most useful sits at the top of a shared prefix.
    const EMOJI_SOURCE = `
✅ check done tick complete yes
❌ x cross no fail wrong
⚠️ warning caution careful risk
🔥 fire hot urgent burning lit
⭐ star favourite favorite important
🚀 rocket ship launch fast release
🐛 bug insect defect issue beetle
📌 pin pinned stick important
📍 pin location place here
⏰ alarm clock time reminder wake
⏳ hourglass waiting time pending
⌛ hourglass done time up
🎯 target goal aim bullseye focus
💡 idea bulb light think
❓ question ask unknown
❗ exclamation important warning
‼️ double exclamation urgent
🔴 red circle stop blocked critical
🟠 orange circle warning medium
🟡 yellow circle caution waiting
🟢 green circle go ok done
🔵 blue circle info note
🟣 purple circle
⚫ black circle
⚪ white circle
🔒 lock locked private secure
🔓 unlock open unlocked
🔑 key password access
🛡️ shield security protect defend
👀 eyes look watch review seeing
✏️ pencil write edit draft
📝 memo note write document
📄 page document file paper
📁 folder directory files
🗂️ dividers files organise organize
📊 chart bar data stats analytics
📈 chart up growth increase win
📉 chart down decrease loss drop
🗓️ calendar date schedule plan
📅 calendar date day schedule
🕐 clock time hour
⏱️ stopwatch timer speed
🔔 bell notification alert reminder
🔕 bell off mute silent
📢 megaphone announce loud news
💬 speech bubble comment chat talk
💭 thought bubble thinking idea
📣 megaphone shout announce
✉️ envelope mail email letter
📧 email mail message
📮 postbox send mail
📦 package box ship delivery
🎁 gift present surprise
🛠️ tools build fix repair
🔧 wrench fix tool repair settings
🔨 hammer build fix
⚙️ gear settings config cog options
🧰 toolbox tools kit
🧪 test tube experiment lab try
🔬 microscope research inspect science
🧹 broom clean cleanup sweep tidy
🗑️ trash bin delete remove waste
♻️ recycle reuse refresh loop
🔁 repeat loop again recurring
🔄 refresh sync reload update
↩️ undo back return
⏭️ next skip forward
⏸️ pause hold wait
▶️ play start go run
⏹️ stop end halt
🆕 new fresh
🆗 ok fine good
🆙 up level upgrade
🔝 top up best
🔜 soon later next
🔙 back previous
💯 hundred perfect full score
✔️ check tick yes done
➕ plus add new more
➖ minus remove less
✖️ multiply times cross
➗ divide
🟩 green square done ok
🟥 red square blocked stop
🟨 yellow square waiting
🟦 blue square info
⬛ black square
⬜ white square
🔺 red triangle up increase
🔻 red triangle down decrease
🔷 blue diamond
🔶 orange diamond
💎 diamond gem valuable precious
👍 thumbs up yes good agree like
👎 thumbs down no bad disagree
👌 ok perfect fine good
🙏 pray thanks please grateful
👏 clap applause well done bravo
🙌 raise hands celebrate praise
🤝 handshake deal agree partner
💪 muscle strong effort power
✊ fist power solidarity
👋 wave hello hi bye
🤞 fingers crossed hope luck
🫶 heart hands love thanks
👉 point right this next
👈 point left back previous
👆 point up above
👇 point down below
🖐️ hand stop five
🤙 call me shaka
🧠 brain think smart mind idea
👤 person user profile someone
👥 people users team group
🧑‍💻 developer coder programmer working
👨‍💻 man developer coder programmer
👩‍💻 woman developer coder programmer
🦸 hero super saviour
😀 grin smile happy
😃 smile happy joy
😄 laugh happy smile
😁 beam grin happy
😆 laughing lol funny
😅 sweat smile relief phew nervous
🤣 rofl laughing hard funny
😂 joy tears laughing crying funny
🙂 slight smile ok fine
🙃 upside down irony sarcasm
😉 wink joking
😊 blush happy smile warm
😇 innocent halo angel
🥰 love hearts adore
😍 heart eyes love amazing
😘 kiss love
😋 yum tasty delicious
😎 cool sunglasses awesome
🤩 star struck amazing wow
🥳 party celebrate birthday
😏 smirk sly
😐 neutral meh flat
😑 expressionless blank
😶 no mouth silent speechless
🙄 eye roll whatever annoyed
😬 grimace awkward yikes
🤔 thinking hmm consider question
🤨 raised eyebrow suspicious doubt
😴 sleeping tired zzz asleep
😪 sleepy tired
😮‍💨 exhale relief sigh
😤 huff frustrated determined
😠 angry mad annoyed
😡 rage furious angry
🤯 mind blown shocked wow
😱 scream shocked fear
😨 fearful scared worried
😰 anxious worried sweat
😢 cry sad tear
😭 sobbing crying very sad
😔 sad down disappointed
😞 disappointed sad
🙁 frown sad
☹️ frowning sad
😕 confused unsure
😩 weary tired frustrated
😫 tired exhausted done
🥱 yawn bored tired
🤒 sick ill fever
🤕 hurt injured bandage
🤢 nauseous sick gross
🤮 vomit sick disgusting
🥴 woozy dizzy confused
🤐 zipper quiet secret
🤫 shush quiet secret
🤭 oops giggle
🫠 melting overwhelmed hot
🫡 salute yes sir on it
❤️ heart love red
🧡 orange heart
💛 yellow heart
💚 green heart
💙 blue heart
💜 purple heart
🖤 black heart
🤍 white heart
💔 broken heart sad
💖 sparkling heart love
✨ sparkles magic new shiny clean
🎉 party tada celebrate confetti launch
🎊 confetti celebrate party
🏆 trophy win award first
🥇 gold medal first win
🥈 silver medal second
🥉 bronze medal third
🎖️ medal honour award
👑 crown king queen best
🔮 crystal ball predict future
🎲 dice random chance luck
🎨 art paint design creative
🎵 music note song
🎧 headphones music listen focus
📷 camera photo picture screenshot
🎥 movie video film record
📱 phone mobile device
💻 laptop computer work
🖥️ desktop computer monitor screen
⌨️ keyboard type shortcut
🖱️ mouse click
🖨️ printer print
💾 floppy save disk
💽 disk data
🗄️ cabinet archive storage files
🌐 globe web internet www world
🔗 link url chain connect
📡 satellite signal network sync
🔌 plug power connect
🔋 battery power charge
⚡ lightning fast power energy zap
☀️ sun sunny day clear
🌤️ sun cloud partly
☁️ cloud cloudy
🌧️ rain wet weather
⛈️ storm thunder
❄️ snow cold winter freeze
🌙 moon night late
🌟 glowing star shine
🌈 rainbow colour pride
🔥 flame hot
🌱 seedling grow new start
🌳 tree growth nature
🍀 clover luck fortune
🌸 blossom flower spring
🐢 turtle slow steady
🐇 rabbit fast quick
🐝 bee busy work
🦋 butterfly change transform
🐳 whale big
🐙 octopus many arms multitask
🦉 owl wise night
🐈 cat kitty
🐕 dog puppy
☕ coffee morning caffeine break
🍵 tea break calm
🍺 beer drink celebrate
🍕 pizza food lunch
🍔 burger food
🍎 apple fruit healthy
🍌 banana fruit
🥕 carrot vegetable
🍞 bread food
🧀 cheese food
🍫 chocolate sweet treat
🍰 cake birthday sweet
🍪 cookie sweet snack
🏠 house home
🏢 office building work
🏥 hospital health
🏦 bank money
🏫 school study learn
🚗 car drive travel
🚕 taxi cab
🚌 bus transport
🚆 train transport commute
✈️ plane flight travel holiday
🚲 bicycle bike ride
🛴 scooter ride
⛵ sailboat sail slow
🏝️ island holiday vacation break
🗺️ map plan route explore
🧭 compass direction navigate find
💰 money bag cash budget
💵 dollar money cash
💳 card payment pay
🧾 receipt invoice expense bill
📃 scroll document
🔍 search find magnify look
🔎 search find zoom
📚 books read study learn
📖 open book read docs
🏁 finish flag done end race
🚩 flag mark issue attention
🎬 action clapper start film
`.trim();

    // Parsed once: [glyph, "words that find it"].
    const EMOJI_LIST = EMOJI_SOURCE.split("\n").map((line) => {
      const at = line.indexOf(" ");
      return at < 0 ? null : [line.slice(0, at), line.slice(at + 1)];
    }).filter(Boolean);

