/*
 * pokemon.js
 *
 * All in-game functionality is in this file
 */

// Initialise some variables
var currentPokemonNumber;
var currentPokemonNames = {}; // a dictionary which stores English, French and German names of the current Pokemon
var currentPokemonImageUrl;
var lastLanguageAnswered = 'en';

// For Pokemon cries
var currentPokemonSoundUrl;
var timesSoundPlayed;

// For generation selection
var minPokemonNumber = -1;
var maxPokemonNumber = -1;
var currentGen = -1;
var newGen = -1;

// To count streaks
var correctCount = [0, 0, 0, 0];
var bestCount = [0, 0, 0, 0]; // separate count for each difficulty

// For countdown timer after a correct answer
var nextTimer = 3;
var intervalId;

// For timing how long an answer takes
var startTime;
var bestTimes = ['-', '-', '-', '-'];
var timeTaken = '-';
var totalTimeTaken = [0, 0, 0, 0];
var totalGuesses = [0, 0, 0, 0]; // average time will be totalTimeTaken / totalGuesses

// Store the name of the Pokemon that was guessed in the fastest time
var bestPokemonNumber = [-1, -1, -1, -1]; 

// Used for difficulty setting
var currentDifficulty = -1;
var newDifficulty = -1;
var imageDirectory;

// Set if a Pokemon image has been preloaded
var pokemonPreloaded = false;
var preloadedGen = -1;
var preloadedDifficulty = -1;

// This will store the current image loaded
var loadedImage;

// Counts the number of times in a row an image has failed to load
var consecutiveLoadFails = 0;

// Will be used to hold the ID of the image loading timeout so it can be disabled if necessary
var imageTimeoutId;

// Spelling tolerance
var spellingLevel = -1;

// Stat tracking
var stats;
var untrackedPokemon = 0;

// Will be used as an array to store upcoming Pokemon
var upcomingPokemon;
var upcomingPokemonArrayPos;

// Sound setting
var soundLevel = -1;

/*
 * Initiates the page on first load
 */

function init() {    
    loadState();
    
    generateNewNumbers(true);
    newPokemon();
    
    var c = readCookie('lastInfobox');
    
    if( (c!==null) && (c <= 20130424) )
        document.getElementById('infobox').setAttribute('style', 'display: none;');
    
    document.getElementById('pokemonCryPlayer').addEventListener('ended', soundPlayed);
}



/*
 * Set the range of numbers to generate from depending on the Pokemon Generation selected
 */
 
function setGen(selectedGen) {

    if (selectedGen == 1) {
        minPokemonNumber = 1;
        maxPokemonNumber = 151;
    } else if (selectedGen == 2) {
        minPokemonNumber = 152;
        maxPokemonNumber = 251;
    } else if (selectedGen == 3) {
        minPokemonNumber = 252;
        maxPokemonNumber = 386;
    } else if (selectedGen == 4) {
        minPokemonNumber = 387;
        maxPokemonNumber = 493;
    } else if (selectedGen == 5) {
        minPokemonNumber = 494;
        maxPokemonNumber = 649;
    } else {
        minPokemonNumber = 1;
        maxPokemonNumber = 649;
    }

    if (newGen == -1) {
        // first time this has been called, so make the choice active, not just selected
        document.getElementById('gen' + selectedGen).className += " current";
        currentGen = selectedGen;
    } else {
        document.getElementById('gen' + newGen).className = document.getElementById('gen' + newGen).className.replace('selected','');
        
        // only make it selected if it's not already current
        if(selectedGen != currentGen)
           document.getElementById('gen' + selectedGen).className += " selected";
           
        document.getElementById('infoBoxMain').setAttribute('style', 'display: inherit');
    }
    
    newGen = selectedGen;
    
    /*
     * This should only happen if the user has reached the end of a generation and then changed
     * the generation. It instantly puts up a new Pokemon.
     */
    if(currentPokemonNumber === -1) {
        generateNewNumbers(true);
        newPokemon();
    }

}

/*
 * Sets the difficulty level, which is essentially choosing where we get the images from.
 */

function setDifficulty(selectedDifficulty) {

    if (selectedDifficulty == 0) {
        imageDirectory = 'images/artwork/';
    } else if (selectedDifficulty == 1) {
        imageDirectory = 'images/sprites/front/';
    } else if (selectedDifficulty == 2) {
        imageDirectory = 'images/sprites/back/';
    } else {
        imageDirectory = null;
    }
    
    if (newDifficulty == -1) {
        document.getElementById('diff' + selectedDifficulty).className += " current";
        currentDifficulty = selectedDifficulty;
    } else {
        document.getElementById('diff' + newDifficulty).className = document.getElementById('diff' + newDifficulty).className.replace('selected','');
        
        if(selectedDifficulty != currentDifficulty)
            document.getElementById('diff' + selectedDifficulty).className += " selected";
            
        document.getElementById('infoBoxMain').setAttribute('style', 'display: inherit');
    }
    
    newDifficulty = selectedDifficulty; 
    
}



/*
 * Sets the tolerance for bad spelling. Right now there are two settings -- exact and
 * forgiving.
 */

function setSpelling(level) {
    document.getElementById('spell' + level).className += " current";
    
    if(spellingLevel !== -1 )
        document.getElementById('spell' + spellingLevel).className = document.getElementById('spell' + spellingLevel).className.replace('current','');
    
    spellingLevel = level;
}



/*
 * Turns Pokemon cries on or off
 */

function setSound(level) {
    document.getElementById('sound' + level).className += " current";
    
    if(soundLevel !== -1 )
        document.getElementById('sound' + soundLevel).className = document.getElementById('sound' + soundLevel).className.replace('current','');
    
    soundLevel = level;
}

/*
 * Remove the silhouette of the Pokemon, and show the user that they are right, if they
 * managed to guess themselves.
 */
 
function revealPokemon(correctlyGuessed, language) {

    timeTaken = new Date().getTime() - startTime;
    clearTimeout(imageTimeoutId);

    silhouette(currentPokemonImageUrl, 'shadowImage', false);
    
    if(soundLevel == 1)
        document.getElementById('pokemonCryPlayer').play();

    inputField = document.getElementById('pokemonGuess');
    
    if(correctlyGuessed) {
        /*
         * Chrome appears to have a bug where the field continues to take input after
         * the input field is disabled, so we need to check here before increasing the count.
         */
        if(!inputField.disabled) {
        
            inputField.className += " correct";
            correctCount[currentDifficulty]++;
            
            // Increase the best count if it has been beaten
            if(correctCount[currentDifficulty] > bestCount[currentDifficulty]) {
                bestCount[currentDifficulty] = correctCount[currentDifficulty];
            }
            
            // Check if the best time has been beaten
            if(timeTaken < bestTimes[currentDifficulty] || bestTimes[currentDifficulty] == '-') {
                bestTimes[currentDifficulty] = timeTaken;
                bestPokemonNumber[currentDifficulty] = currentPokemonNumber;
            }
            
            totalTimeTaken[currentDifficulty] += timeTaken;
            totalGuesses[currentDifficulty] += 1;
            
        }
        
        trackCurrentPokemon(1);
        
        lastLanguageAnswered = language;
    } else {
        trackCurrentPokemon(0);
        correctCount[currentDifficulty] = 0;
        timeTaken = '-';
    }
    
    // Should only happen once, and regardless of whether the user got it right or wrong
    if(!inputField.disabled) {   
        nextCountdown();
        intervalId = setInterval(nextCountdown, 1000);
    }
    
    inputField.disabled = true;
    
    // Give the Pokemon name
    document.getElementById('pokemonGuess').value = currentPokemonNames[lastLanguageAnswered];
    
    document.getElementById('currentCountText').innerHTML = correctCount[currentDifficulty];
    document.getElementById('bestCountText').innerHTML = bestCount[currentDifficulty];
    
    if(correctlyGuessed && !isNaN(timeTaken))
        document.getElementById('lastTimeText').innerHTML = timeTaken/1000;
    else
        document.getElementById('lastTimeText').innerHTML = '-';
        
    if(bestTimes[currentDifficulty] != '-')
        document.getElementById('bestTimeText').innerHTML = bestTimes[currentDifficulty]/1000;
        
    if(bestPokemonNumber[currentDifficulty] > 0)
        document.getElementById('bestTimePokemon').innerHTML = '(' + getLocalPokemonName(bestPokemonNumber[currentDifficulty]) + ')';
    
    if(totalGuesses[currentDifficulty] > 0) {
        var avgTime = totalTimeTaken[currentDifficulty] / totalGuesses[currentDifficulty] / 1000;
        document.getElementById('averageTimeText').innerHTML = avgTime.toFixed(3);
    }
    
    document.getElementById('giveAnswer').setAttribute('style', 'display: none');
    document.getElementById('nextCountdown').setAttribute('style', 'display: block');
    
    // Update to any new settings that have been selected
    generateNewNumbers();
    
    // Preload the next Pokemon
    preloadPokemon();
    
}



/*
 * Creates a new random array of Pokemon numbers if the selected generation has changed.
 * The force parameter will ignore the check for a generation change.
 */

function generateNewNumbers(force) {

    if(force || (currentGen !== newGen)) {
        var i=0, j;
        
        upcomingPokemon = new Array();
        upcomingPokemonArrayPos = 0;
        
        for(j=minPokemonNumber; j<=maxPokemonNumber; j++) {
            upcomingPokemon[i] = j;
            i++;
        }
        
        shuffle(upcomingPokemon);
    }

}

/*
 * Generates a new Pokemon and loads the image, but doesn't display it. Returns true if
 * it preloaded, false otherwise.
 */

function preloadPokemon() {
    currentPokemonNumber = getRandomPokemonNumber();
    
    if(currentPokemonNumber > 0) {
        currentPokemonNames = getPokemonNames(currentPokemonNumber);
        currentPokemonImageUrl = getPokemonImageUrl(currentPokemonNumber);
    } else {
        return false;
    }
    
    if(currentPokemonImageUrl !== null) {
        img = new Image();
        img.src = currentPokemonImageUrl;
        pokemonPreloaded = true;
        preloadedGen = currentGen;
        preloadedDifficulty = currentDifficulty;
        return true;
    } else {
        return false;
    }
}



/*
 * Display a new random Pokemon
 */
 
function newPokemon() {

    clearCanvas('shadowImage');
    
    /*
     * Generate a new Pokemon if one hasn't already been preloaded, or if the settings have
     * changed since the Pokemon was revealed.
     */
    if(!pokemonPreloaded || preloadedGen != newGen || preloadedDifficulty != newDifficulty) {
        if(preloadedGen != newGen)
            generateNewNumbers(true);
        currentPokemonNumber = getRandomPokemonNumber();
    }
    
    nextTimer = 3;
    clearInterval(intervalId);
    
    if(currentPokemonNumber < 0) {
        generationFinished();
    } else {
        pokemonPreloaded = false;
        
        currentPokemonNames = getPokemonNames(currentPokemonNumber);
        currentPokemonImageUrl = getPokemonImageUrl(currentPokemonNumber);
        currentPokemonSoundUrl = getPokemonSoundUrl(currentPokemonNumber);
        
        inputField = document.getElementById('pokemonGuess');
        inputField.className = inputField.className.replace('correct','');
        inputField.disabled = false;
        inputField.value = '';
        
        document.getElementById('giveAnswer').setAttribute('style', 'display: block');
        document.getElementById('nextCountdown').setAttribute('style', 'display: none');
        
        document.getElementById('infoBoxMain').setAttribute('style', 'display: none');
        
        timesSoundPlayed = 0;
        
        // Save the settings and refresh the settings boxes
        updateStateAndRefreshUI();
        saveState();
        
        // Now load the next Pokemon
        if(currentPokemonImageUrl !== null) {
            silhouette(currentPokemonImageUrl, 'shadowImage', true);
            imageTimeoutId = setTimeout(checkPokemonLoaded, 10000);
        }
        
        document.getElementById('pokemonCryPlayer').setAttribute('src', currentPokemonSoundUrl);
    
        /*
         * This will get set again on loading of the silhouette, but we need to specify it here
         * so we have a timer for non-image guessing
         */
        startTime = new Date().getTime();
        
        showMain();
    }
    
}



/*
 * Shows a message to the user if they have completed the entire generation
 */

function generationFinished() {
    var message = '<p>Well done, you got through the whole generation! Why not try a different setting?</p>';;
    messageDiv = document.getElementById('infoMessage');
    messageDiv.innerHTML = message;
    messageDiv.setAttribute('style', 'display: inherit');
    hideMain();
}

/* 
 * Hide the playing area 
 */
function hideMain() {
    document.getElementById('playArea').setAttribute('style', 'display: none');
    document.getElementById('infoMessage').setAttribute('style', 'display: inherit');
}

/*
 * Show the playing area
 */
function showMain() {
    document.getElementById('playArea').setAttribute('style', 'display: inherit');
    document.getElementById('infoMessage').setAttribute('style', 'display: none');    
}

/*
 * Checks to see if the Pokemon image has been loaded. If not, a link is offered to try to 
 * load another.
 */
 
function checkPokemonLoaded() {
 
    if(!loadedImage.complete || loadedImage.naturalWidth == 0 || loadedImage.naturalHeight == 0) {
    
        if(++consecutiveLoadFails < 3) {
            document.getElementById('nextCountdown').innerHTML = 'This is taking a while to load. Do you want to try loading another one? It won\'t affect your streak. <a href="#" onclick="newPokemon();">Load a new Pok&eacute;mon?</a>';
        } else {
            document.getElementById('nextCountdown').innerHTML = 'Is your connection slow or down? Maybe try a harder difficulty, they load faster. Or <a href="#" onclick="newPokemon();">Load a new Pok&eacute;mon?</a>';
        }
        
        document.getElementById('nextCountdown').setAttribute('style', 'display: block');
    
    } else {
    
        consecutiveLoadFails = 0;
    
    }
 
 }



/*
 * Refreshes the streak and time counters, as well as the generation and difficulty links,
 * if a new one has been selected. Also does some more advanced stuff, like showing the 
 * sound player for higher difficulties.
 */
 
function updateStateAndRefreshUI() {
        
    if(newGen != currentGen) {
        // The generation has been updated, so highlight the new one
        document.getElementById('gen' + currentGen).className = document.getElementById('gen' + currentGen).className.replace('current','');
        document.getElementById('gen' + newGen).className = document.getElementById('gen' + currentGen).className.replace('selected','');
        document.getElementById('gen' + newGen).className += ' current';
        currentGen = newGen;
    }
    
    if(newDifficulty != currentDifficulty) {
        // The difficulty has been updated, so highlight the new one
        document.getElementById('diff' + currentDifficulty).className = document.getElementById('diff' + currentDifficulty).className.replace('current','');
        document.getElementById('diff' + newDifficulty).className = document.getElementById('diff' + currentDifficulty).className.replace('selected','');
        document.getElementById('diff' + newDifficulty).className += ' current';
        
        // Show the info box explaining that the change means different streaks and times
        document.getElementById('infoBoxRight').setAttribute('style', 'display: inherit');
        
        currentDifficulty = newDifficulty;      
    } else {
        document.getElementById('infoBoxRight').setAttribute('style', 'display: none');
    }
        
    // We're into a sound-based difficulty
    if(currentDifficulty > 2) {
        document.getElementById('canvasContainer').setAttribute('style', 'display: none');
        document.getElementById('pokemonCryPlayer').setAttribute('controls', 'controls');
        setSound(1); 
    } else {
        document.getElementById('canvasContainer').setAttribute('style', 'display: inherit');
        document.getElementById('pokemonCryPlayer').removeAttribute('controls');
        document.getElementById('pokemonCryPlayer').removeAttribute('autoplay');
    }

    document.getElementById('bestCountText').innerHTML = bestCount[currentDifficulty];
    document.getElementById('currentCountText').innerHTML = correctCount[currentDifficulty];
    
    if (bestPokemonNumber[currentDifficulty] > 0) {
        document.getElementById('bestTimePokemon').innerHTML = '(' + getLocalPokemonName(bestPokemonNumber[currentDifficulty]) + ')';
    } else {
        document.getElementById('bestTimePokemon').innerHTML = '';
    }
    
    if (bestTimes[currentDifficulty] == '-') {
        document.getElementById('bestTimeText').innerHTML = '-';
    } else {
        document.getElementById('bestTimeText').innerHTML = bestTimes[currentDifficulty]/1000;
    }
        
    if (totalGuesses[currentDifficulty] > 0) {
        var avgTime = totalTimeTaken[currentDifficulty] / totalGuesses[currentDifficulty] / 1000;
        document.getElementById('averageTimeText').innerHTML = avgTime.toFixed(3);
    } else {
        document.getElementById('averageTimeText').innerHTML = '-';
    }

    if (timeTaken == '-') {
        document.getElementById('lastTimeText').innerHTML = '-';     
    } else {
        document.getElementById('lastTimeText').innerHTML = timeTaken/1000;
    }

}



/*
 * Wipes the canvas clean. This is useful if a Pokemon is slow to load, as we don't
 * want the previous Pokemon still there while the other is loading -- that's confusing to the user.
 */

function clearCanvas(canvasId) {
    var canvas = document.getElementById(canvasId),
        ctx = canvas.getContext('2d');
        
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}


/*
 * Function: silhouette
 * Description: Creates a silhouette from a given image URL and draws it to a given canvas. For
 *              this to work properly, the image must have transparency of some sort.
 * Parameters:  imageURL: URL of the image to load
 *              canvasId: The ID of the canvas to which the new image will be drawn
 *              doSilhouette: Set this to true to actually do the silhouette. If false, the image
 *                            will be drawn directly to the canvas without silhouetting it. This
 *                            is useful if you want to do some sort of click-to-reveal functionality.
 * Returns: None
 */
 
function silhouette(imageUrl, canvasId, doSilhouette) {

    if(imageUrl === null)
        return false;

    var canvas = document.getElementById(canvasId),
        ctx = canvas.getContext('2d');
        
    loadedImage = new Image();
        
    loadedImage.src = imageUrl;

    loadedImage.onload = function() {   
        // On higher difficulties, the images are smaller. This makes them bigger.
        if(loadedImage.width <= 100) {
            canvas.width = loadedImage.width * 4;
            canvas.height = loadedImage.height * 4;
        } else {
            canvas.width = loadedImage.width;
            canvas.height = loadedImage.height;
        }
        
        ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
  
        if(doSilhouette) {
            var rawImage = ctx.getImageData(0,0,canvas.width,canvas.height);
            
            for (var i=0; i<rawImage.data.length;i+=4) {
                if(rawImage.data[i+3] >= 100) {
                    rawImage.data[i] = 30;
                    rawImage.data[i+1] = 30;
                    rawImage.data[i+2] = 30;
                    rawImage.data[i+3] = 255;
                } else {
                    rawImage.data[i+3] = 0;
                }
            }
            
            ctx.putImageData(rawImage,0,0);
        }
        centrePokemon();
        startTime = new Date().getTime();
    }
}



/*
 * Displays a countdown to the next Pokemon
 */

function nextCountdown() {
    if(nextTimer > 0) {
        document.getElementById('nextCountdown').innerHTML = 'Next Pok&eacute;mon in ' + nextTimer + ' seconds';
        nextTimer--;
    } else {
        newPokemon();
    }
}



/*
 * Give the answer if the user has given up.
 */
 
function giveAnswer() {
    revealPokemon(false);
}



/*
 * Centres the canvas with the Pokemon in it
 */

function centrePokemon() {
    c = document.getElementById('shadowImage');
    c.setAttribute('style', 'margin-top:' + Math.floor((350 - c.height) / 2) + 'px');
}


/*
 * Deletes cookies relating to time records
 */
function clearTimes() {
    eraseCookie('bestTime');
    bestTime = '-';
    document.getElementById('bestTimeText').innerHTML = bestTime;
    document.getElementById('lastTimeText').innerHTML = '-';
}



/*
 * Sort of a relic from when the number was randomly generated on demand. Still useful to
 * have to return a number from the randomised array.
 */
 
function getRandomPokemonNumber() {
    var number;
    if(upcomingPokemonArrayPos > (maxPokemonNumber-minPokemonNumber+1)) {
        number = -1;
    } else {
        number = upcomingPokemon[upcomingPokemonArrayPos++];
    }
    return number;
}



/*
 * Get the names of a Pokemon, given the number. The array of names starts at 0, so we need to
 * subtract 1 from the given number to get the right name.
 */
 
function getPokemonNames(number) {
    var names = { 'en' : englishPokemon[number-1], 'fr' : frenchPokemon[number-1], 'de' : germanPokemon[number-1] };
    return names;
}

function getLocalPokemonName(number) {
    return getPokemonNames(number)[lastLanguageAnswered];
}


/*
 * Get the URL of the Pokemon image. The format is 123.png. On failure, it returns false.
 */
 
function getPokemonImageUrl(number) {
    if(imageDirectory !== null)
        return imageDirectory + number + '.png';
    else
        return null;
}



/*
 * Get the URL of the Pokemon cry. The format is 123.ogg.
 */

function getPokemonSoundUrl(number) {
    return 'sounds/cries/' + number + '.ogg';
}



/*
 * Called when a cry has been played. Should only apply when we are doing sound-only guessing.
 */
 
function soundPlayed() {
    if(currentDifficulty > 2) {
        document.getElementById('pokemonCryPlayer').setAttribute('autoplay', 'autoplay');
        timesSoundPlayed++;
    }
}



/*
 * Check to see if the guess equals the answer in any language. If it does, reveal the Pokemon, else return false.
 */
 
function checkPokemonAnswer(g) {
    var guess = g.toLowerCase();
    
    // First check English, then French and German
    if ( ( spellingLevel > 0 ) && ( soundAlike(guess, currentPokemonNames['en']) ) ) {
        revealPokemon(true, 'en');
    } else if (guess == currentPokemonNames['en']) {
        revealPokemon(true, 'en');
    } else if (guess == removeAccents(currentPokemonNames['fr'])) {
        revealPokemon(true, 'fr');
    } else if (guess == removeAccents(currentPokemonNames['de'])) {
        revealPokemon(true, 'de');
    } else {
        return false;
    }
}



/*
 * Returns true if both inputs can be considered to be alike-sounding words, else false.
 */

function soundAlike(s1, s2, lang) {
    var l;

    if(lang === 'fr' || lang === 'de') {
        l = ( levenshtein(s1, s2) < 3 );
    } else {
        l = ( ( soundex(s1) === soundex(s2) ) && ( levenshtein(s1, s2) < 3 ) )
    }
    return l;
}


/*
 * This returns a 'soundex', which gives a general idea of what a word sounds like.
 * From https://github.com/kvz/phpjs/blob/master/functions/strings/soundex.js
 */

function soundex (str) {
  str = (str + '').toUpperCase();
  if (!str) {
    return '';
  }
  var sdx = [0, 0, 0, 0],
    m = {
      B: 1, F: 1, P: 1, V: 1,
      C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
      D: 3, T: 3,
      L: 4,
      M: 5, N: 5,
      R: 6
    },
    i = 0,
    j, s = 0,
    c, p;

  while ((c = str.charAt(i++)) && s < 4) {
    if (j = m[c]) {
      if (j !== p) {
        sdx[s++] = p = j;
      }
    } else {
      s += i === 1;
      p = 0;
    }
  }

  sdx[0] = str.charAt(0);
  return sdx.join('');
}

/*
 * Calculates how many letters are different between two words
 * From https://github.com/kvz/phpjs/blob/master/functions/strings/levenshtein.js
 */

function levenshtein (s1, s2) {
  // http://kevin.vanzonneveld.net
  // +            original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
  // +            bugfixed by: Onno Marsman
  // +             revised by: Andrea Giammarchi (http://webreflection.blogspot.com)
  // + reimplemented by: Brett Zamir (http://brett-zamir.me)
  // + reimplemented by: Alexander M Beedie
  // *                example 1: levenshtein('Kevin van Zonneveld', 'Kevin van Sommeveld');
  // *                returns 1: 3
  if (s1 == s2) {
    return 0;
  }

  var s1_len = s1.length;
  var s2_len = s2.length;
  if (s1_len === 0) {
    return s2_len;
  }
  if (s2_len === 0) {
    return s1_len;
  }

  // BEGIN STATIC
  var split = false;
  try {
    split = !('0')[0];
  } catch (e) {
    split = true; // Earlier IE may not support access by string index
  }
  // END STATIC
  if (split) {
    s1 = s1.split('');
    s2 = s2.split('');
  }

  var v0 = new Array(s1_len + 1);
  var v1 = new Array(s1_len + 1);

  var s1_idx = 0,
    s2_idx = 0,
    cost = 0;
  for (s1_idx = 0; s1_idx < s1_len + 1; s1_idx++) {
    v0[s1_idx] = s1_idx;
  }
  var char_s1 = '',
    char_s2 = '';
  for (s2_idx = 1; s2_idx <= s2_len; s2_idx++) {
    v1[0] = s2_idx;
    char_s2 = s2[s2_idx - 1];

    for (s1_idx = 0; s1_idx < s1_len; s1_idx++) {
      char_s1 = s1[s1_idx];
      cost = (char_s1 == char_s2) ? 0 : 1;
      var m_min = v0[s1_idx + 1] + 1;
      var b = v1[s1_idx] + 1;
      var c = v0[s1_idx] + cost;
      if (b < m_min) {
        m_min = b;
      }
      if (c < m_min) {
        m_min = c;
      }
      v1[s1_idx + 1] = m_min;
    }
    var v_tmp = v0;
    v0 = v1;
    v1 = v_tmp;
  }
  return v0[s1_len];
}




/*
 * Tracks stats to be sent to the backend database
 */

function trackCurrentPokemon(correct) {

    if (untrackedPokemon === 0) {
        // Initialise the stats object
        stats = new Array();
    }
    
    stats[untrackedPokemon] = new Object();
    stats[untrackedPokemon].pokemonId = currentPokemonNumber;
    stats[untrackedPokemon].correct = correct;
    stats[untrackedPokemon].difficulty = currentDifficulty;
    stats[untrackedPokemon].generation = currentGen;
    stats[untrackedPokemon].timeTaken = timeTaken;
    untrackedPokemon++;
    
    // Send stats to the server every 5 guesses
    if (untrackedPokemon >= 5) {
        var jsonStats = JSON.stringify(stats),
            req = new XMLHttpRequest();
        req.open('POST', 'jsonstats.php');
        req.setRequestHeader('Content-type', 'application/json', true);
        req.send(jsonStats);
        untrackedPokemon = 0;
    }
        
}



/*
 * Fisher-Yates array shuffle from http://bost.ocks.org/mike/shuffle/
 */
 
function shuffle(array) {
    var m = array.length, t, i;

    // While there remain elements to shuffle…
    while (m) {
        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);

        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    return array;
}



/*
 * Hide the infobox that shows updates
 */

function hideInfobox(d) {
    document.getElementById('infobox').setAttribute('style', 'display: none');
    createCookie('lastInfobox', d, 365);
}

/*
 * Cookie stuff from http://www.quirksmode.org/js/cookies.html
 */
 
function createCookie(name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	createCookie(name,"",-1);
}

/*
 * Functions to save settings to cookies, and to load them back
 */
 
function saveState() {
    createCookie('generation', currentGen, 365);
    createCookie('difficulty', currentDifficulty, 365);
    createCookie('spelling', spellingLevel, 365);
    createCookie('sound', soundLevel, 365);
    
    for(var i=0; i<bestCount.length; i++) {
        if (bestCount[i] > 0) {
            createCookie('bestCount'+i, bestCount[i], 365);
        }
    
        if (bestTimes[i] != '-') {
            createCookie('bestTime'+i, bestTimes[i], 365);
        }
    
        if (bestPokemonNumber[i] > 0) {
            createCookie('bestPokemon'+i, bestPokemonNumber[i], 365);
        }
        
        if (totalTimeTaken[i] > 0) {
            createCookie('totalTimeTaken'+i, totalTimeTaken[i], 365);
        }
        
        if (totalGuesses[i] > 0) {
            createCookie('totalGuesses'+i, totalGuesses[i], 365);
        }
    }
}

function loadState() {
    var c;
    
    c = readCookie('generation');
    
    if( (c !== null) && (c >= 0) && (c <= 5) ) {
        setGen(c);
    } else {
        setGen(0);
    }
    
    c = readCookie('difficulty');
    
    if( (c !== null) && (c >= 0) && (c <= 3) ) {
        setDifficulty(c);
    } else {
        setDifficulty(0);
    }
    
    c = readCookie('spelling');
    
    if( (c !== null) && (c >= 0) && (c <= 1) ) {
        setSpelling(c);
    } else {
        setSpelling(0);
    }
    
    c = readCookie('sound');
    
    if( (c !== null) && (c >= 0) && (c <= 1) ) {
        setSound(c);       
    } else {
        setSound(0);
    }
    
    for(var i=0; i<bestCount.length; i++) {
        var bc = readCookie('bestCount' + i);
        var bt = readCookie('bestTime' + i);
        var bp = readCookie('bestPokemon' + i);
        var tt = readCookie('totalTimeTaken' + i);
        var tg = readCookie('totalGuesses' + i);
        
        if (bc > 0) {
            bestCount[i] = parseInt(bc);
        }
    
        if (bt > 0) {
            bestTimes[i] = parseInt(bt);
        }
        
        if (bp > 0) {
            bestPokemonNumber[i] = parseInt(bp);
        }
        
        if (tt > 0) {
            totalTimeTaken[i] = parseInt(tt);
        }
        
        if (tg > 0) {
            totalGuesses[i] = parseInt(tg);
        }
    }
}
